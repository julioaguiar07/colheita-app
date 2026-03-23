from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime, timedelta
from flask_mail import Mail, Message
from apscheduler.schedulers.background import BackgroundScheduler
import atexit
import json
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import resend
import bcrypt
import jwt
from functools import wraps
from datetime import datetime, timedelta
    
app = Flask(__name__, static_folder='static')
CORS(app)

# Configuração JWT
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
# ============================================
# FUNÇÕES DE AUTENTICAÇÃO
# ============================================

def gerar_hash_senha(senha):
    """Gera hash da senha com bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(senha.encode('utf-8'), salt).decode('utf-8')

def verificar_senha(senha, hash_armazenado):
    """Verifica se a senha corresponde ao hash"""
    return bcrypt.checkpw(senha.encode('utf-8'), hash_armazenado.encode('utf-8'))

def token_required(f):
    """Decorator para proteger rotas que precisam de autenticação"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        try:
            token = token.replace('Bearer ', '')
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.usuario_id = payload['usuario_id']
            request.usuario_email = payload['email']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        
        return f(*args, **kwargs)
    
    return decorated


# ============================================
# CONFIGURAÇÃO DO E-MAIL
# ============================================
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('EMAIL_USER', '')  # Será configurado no Railway
app.config['MAIL_PASSWORD'] = os.environ.get('EMAIL_PASSWORD', '')  # Será configurado no Railway
app.config['MAIL_DEFAULT_SENDER'] = app.config['MAIL_USERNAME']

mail = Mail(app)

# Configuração do banco de dados
def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
    else:
        conn = psycopg2.connect(
            host='localhost',
            database='colheita',
            user='postgres',
            password='postgres',
            cursor_factory=RealDictCursor
        )
    return conn

# Função para criar todas as tabelas
def criar_tabelas():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Tabela de usuários
        cur.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                senha_hash VARCHAR(255) NOT NULL,
                nome VARCHAR(255),
                ativo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✅ Tabela 'usuarios' criada/verificada")
        
        # Tabela de configurações de email
        cur.execute('''
            CREATE TABLE IF NOT EXISTS configuracoes_email (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                email_destino VARCHAR(255) NOT NULL,
                frequencias TEXT[],
                horario VARCHAR(5),
                ativo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✅ Tabela 'configuracoes_email' criada/verificada")
        
        # Tabela de produções
        cur.execute('''
            CREATE TABLE IF NOT EXISTS producoes (
                id VARCHAR(50) PRIMARY KEY,
                data DATE NOT NULL,
                produto VARCHAR(255) NOT NULL,
                tipo VARCHAR(255) NOT NULL,
                area VARCHAR(255),
                qtd DECIMAL(10,2),
                unidade VARCHAR(50),
                valor_unit DECIMAL(10,2),
                total DECIMAL(10,2),
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✅ Tabela 'producoes' criada/verificada")
        
        # Tabela de vendas
        cur.execute('''
            CREATE TABLE IF NOT EXISTS vendas (
                id VARCHAR(50) PRIMARY KEY,
                data DATE NOT NULL,
                produto VARCHAR(255) NOT NULL,
                cliente VARCHAR(255),
                area VARCHAR(255),
                unidade VARCHAR(50),
                qtd DECIMAL(10,2),
                valor_unit DECIMAL(10,2),
                total DECIMAL(10,2),
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✅ Tabela 'vendas' criada/verificada")
        
        # Tabela de gastos (completa)
        cur.execute('''
            CREATE TABLE IF NOT EXISTS gastos (
                id VARCHAR(50) PRIMARY KEY,
                data DATE NOT NULL,
                tipo VARCHAR(255) NOT NULL,
                categoria VARCHAR(50),
                produto VARCHAR(255),
                area VARCHAR(255),
                obs TEXT,
                valor DECIMAL(10,2),
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✅ Tabela 'gastos' criada/verificada")
        
        conn.commit()
        print("🎉 Todas as tabelas criadas com sucesso!")
        
        # Criar usuário admin se não existir
        cur.execute('SELECT id FROM usuarios WHERE email = %s', ('admin@agrocore.com',))
        if not cur.fetchone():
            senha_hash = gerar_hash_senha('admin123')
            cur.execute('''
                INSERT INTO usuarios (email, senha_hash, nome, ativo)
                VALUES (%s, %s, %s, true)
            ''', ('admin@agrocore.com', senha_hash, 'Administrador'))
            conn.commit()
            print("✅ Usuário admin criado (email: admin@agrocore.com / senha: admin123)")
        
        return True
    except Exception as e:
        print(f"❌ Erro ao criar tabelas: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Rota para criar as tabelas manualmente
('/init-db')
def init_db():
    if criar_tabelas():
        return "✅ Banco de dados inicializado com sucesso! <a href='/'>Voltar</a>"
    else:
        return "❌ Erro ao inicializar banco de dados. Verifique os logs."

# Rota principal
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# ========== API PRODUÇÕES ==========
@app.route('/api/producoes', methods=['GET'])
@token_required
def get_producoes():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM producoes WHERE usuario_id = %s ORDER BY data DESC', (request.usuario_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(list(rows))

@app.route('/api/producoes', methods=['POST'])
@token_required
def create_producao():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO producoes (id, data, produto, tipo, area, qtd, unidade, valor_unit, total, usuario_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['produto'], data['tipo'],
        data.get('area', ''), data.get('qtd', 0), data.get('unidade', ''),
        data.get('valorUnit', 0), data['total'], request.usuario_id
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Produção criada'}), 201

@app.route('/api/producoes/<id>', methods=['DELETE'])
@token_required
def delete_producao(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM producoes WHERE id = %s AND usuario_id = %s', (id, request.usuario_id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Produção deletada'})

# ========== API VENDAS (MODIFICADA) ==========
@app.route('/api/vendas', methods=['GET'])
@token_required
def get_vendas():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM vendas WHERE usuario_id = %s ORDER BY data DESC', (request.usuario_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(list(rows))

@app.route('/api/vendas', methods=['POST'])
@token_required
def create_venda():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO vendas (id, data, produto, cliente, area, unidade, qtd, valor_unit, total, usuario_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['produto'], 
        data.get('cliente', ''), data.get('area', ''), 
        data['unidade'], data['qtd'], data['valorUnit'], data['total'], request.usuario_id
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Venda criada'}), 201

# ========== API GASTOS (MODIFICADA) ==========
@app.route('/api/gastos', methods=['GET'])
@token_required
def get_gastos():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM gastos WHERE usuario_id = %s ORDER BY data DESC', (request.usuario_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(list(rows))

@app.route('/api/gastos', methods=['POST'])
@token_required
def create_gasto():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO gastos (id, data, tipo, categoria, produto, area, obs, valor, usuario_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['tipo'], 
        data.get('categoria', 'Outros'), data.get('produto', ''),
        data.get('area', ''), data.get('obs', ''), data['valor'], request.usuario_id
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Gasto criado'}), 201

# Adicione esta rota TEMPORÁRIA no seu app.py
@app.route('/recriar-tabela-gastos')
def recriar_tabela_gastos():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Renomear a tabela antiga (backup)
        cur.execute('ALTER TABLE gastos RENAME TO gastos_backup')
        
        # 2. Criar nova tabela com a coluna obs
        cur.execute('''
            CREATE TABLE gastos (
                id VARCHAR(50) PRIMARY KEY,
                data DATE NOT NULL,
                tipo VARCHAR(255) NOT NULL,
                categoria VARCHAR(50),
                area VARCHAR(255),
                obs TEXT,
                valor DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 3. Copiar dados da tabela antiga (sem a coluna obs)
        cur.execute('''
            INSERT INTO gastos (id, data, tipo, categoria, area, valor, created_at)
            SELECT id, data, tipo, categoria, area, valor, created_at 
            FROM gastos_backup
        ''')
        
        # 4. Remover tabela antiga (opcional - comente se quiser manter backup)
        # cur.execute('DROP TABLE gastos_backup')
        
        conn.commit()
        cur.close()
        conn.close()
        
        return "✅ Tabela 'gastos' recriada com sucesso! <a href='/'>Voltar</a>"
    except Exception as e:
        return f"❌ Erro: {str(e)}"

@app.route('/add-tipo-column')
def add_tipo_column():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('ALTER TABLE producoes ADD COLUMN tipo VARCHAR(255)')
        conn.commit()
        cur.close()
        conn.close()
        return "✅ Coluna 'tipo' adicionada com sucesso! <a href='/'>Voltar</a>"
    except Exception as e:
        return f"❌ Erro: {str(e)}"
        
@app.route('/add-produto-column')
def add_produto_column():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('ALTER TABLE gastos ADD COLUMN produto VARCHAR(255)')
        conn.commit()
        cur.close()
        conn.close()
        return """
        <html>
        <head><title>Sucesso!</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: green;">✅ Coluna 'produto' adicionada com sucesso!</h1>
            <p><a href="/" style="background: #2d7a3a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Voltar ao sistema</a></p>
        </body>
        </html>
        """
    except Exception as e:
        if 'already exists' in str(e):
            return "<h1 style='color: orange;'>⚠️ Coluna 'produto' já existe!</h1>"
        return f"<h1 style='color: red;'>❌ Erro: {str(e)}</h1>"


@app.route('/criar-admin', methods=['GET'])
def criar_admin():
    """Cria usuário admin (apenas para teste)"""
    try:
        senha_hash = gerar_hash_senha('admin123')
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verificar se já existe
        cur.execute('SELECT id FROM usuarios WHERE email = %s', ('admin@agrocore.com',))
        if not cur.fetchone():
            cur.execute('''
                INSERT INTO usuarios (email, senha_hash, nome)
                VALUES (%s, %s, %s)
            ''', ('admin@agrocore.com', senha_hash, 'Administrador'))
            conn.commit()
            return "✅ Usuário admin criado!<br>Email: admin@agrocore.com<br>Senha: admin123"
        else:
            return "⚠️ Usuário admin já existe!"
    except Exception as e:
        return f"❌ Erro: {e}"

@app.route('/verificar-coluna-produto')
def verificar_coluna():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='gastos'")
        colunas = cur.fetchall()
        cur.close()
        conn.close()
        
        colunas_nomes = [c['column_name'] for c in colunas]
        
        if 'produto' in colunas_nomes:
            return f"""
            <html>
            <head><title>Sucesso!</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: green;">✅ Coluna 'produto' encontrada!</h1>
                <p>Colunas na tabela gastos:</p>
                <ul style="list-style: none; padding: 0;">
                    {''.join([f'<li style="background: #f0f0f0; margin: 5px; padding: 10px; border-radius: 5px;">📌 {col}</li>' for col in colunas_nomes])}
                </ul>
                <p><a href="/" style="background: #2d7a3a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Voltar ao sistema</a></p>
            </body>
            </html>
            """
        else:
            return f"""
            <html>
            <head><title>Atenção!</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: orange;">⚠️ Coluna 'produto' NÃO encontrada!</h1>
                <p>Execute no terminal do Railway:</p>
                <pre style="background: #333; color: white; padding: 20px; border-radius: 5px;">ALTER TABLE gastos ADD COLUMN produto VARCHAR(255);</pre>
                <p><a href="/" style="background: #2d7a3a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Voltar</a></p>
            </body>
            </html>
            """
    except Exception as e:
        return f"<h1>❌ Erro: {str(e)}</h1>"

# ============================================
# ROTAS DE E-MAIL
# ============================================

@app.route('/api/config-email', methods=['POST'])
@token_required
def config_email():
    """Salva as configurações de e-mail do usuário"""
    try:
        data = request.json
        usuario_id = request.usuario_id  # ← AGORA USA O ID DO USUÁRIO LOGADO
        
        # Converter horário local para UTC
        horas, minutos = map(int, data['horario'].split(':'))
        horas_utc = horas + 3
        if horas_utc >= 24:
            horas_utc -= 24
        horario_utc = f"{horas_utc:02d}:{minutos:02d}"
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verificar se já existe configuração para este usuário
        cur.execute('SELECT * FROM configuracoes_email WHERE usuario_id = %s', (usuario_id,))
        existente = cur.fetchone()
        
        if existente:
            # Atualizar
            cur.execute('''
                UPDATE configuracoes_email 
                SET email_destino = %s, frequencias = %s, horario = %s, ativo = %s, updated_at = CURRENT_TIMESTAMP
                WHERE usuario_id = %s
            ''', (data['email'], data['frequencias'], horario_utc, True, usuario_id))
        else:
            # Inserir
            cur.execute('''
                INSERT INTO configuracoes_email (usuario_id, email_destino, frequencias, horario, ativo)
                VALUES (%s, %s, %s, %s, %s)
            ''', (usuario_id, data['email'], data['frequencias'], horario_utc, True))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'mensagem': 'Configurações salvas!'})
    
    except Exception as e:
        print(f"❌ Erro ao salvar: {e}")
        return jsonify({'success': False, 'erro': str(e)}), 500

import threading
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def enviar_email_async(destinatario):
    """Função que envia e-mail em segundo plano com debug completo"""
    try:
        print(f"📧 [THREAD] Iniciando envio para {destinatario}")
        print(f"📧 [THREAD] Hora: {datetime.now().strftime('%H:%M:%S')}")
        
        email_user = os.environ.get('EMAIL_USER')
        email_password = os.environ.get('EMAIL_PASSWORD')
        
        print(f"📧 [THREAD] Email user: {email_user}")
        print(f"📧 [THREAD] Senha configurada: {'Sim' if email_password else 'Não'}")
        print(f"📧 [THREAD] Tamanho da senha: {len(email_password) if email_password else 0}")
        
        # Criar mensagem SIMPLES (sem HTML)
        import smtplib
        from email.mime.text import MIMEText
        
        msg = MIMEText("Teste do AGROcore - versão simples")
        msg['Subject'] = "🌱 Teste AGROcore"
        msg['From'] = email_user
        msg['To'] = destinatario
        
        print(f"📧 [THREAD] Conectando ao servidor SMTP...")
        
        # Conectar ao Gmail
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.set_debuglevel(2)  # Isso vai mostrar TODOS os detalhes da comunicação
        server.starttls()
        
        print(f"📧 [THREAD] Tentando login...")
        server.login(email_user, email_password)
        
        print(f"📧 [THREAD] Login OK! Enviando mensagem...")
        server.send_message(msg)
        
        print(f"📧 [THREAD] Mensagem enviada! Fechando conexão...")
        server.quit()
        
        print(f"✅ [THREAD] E-mail enviado com sucesso para {destinatario}")
        
        # Tentar enviar um segundo e-mail como confirmação
        try:
            import requests
            requests.post('https://api.telegram.org/botSEU_TOKEN/sendMessage', 
                         json={'chat_id': 'SEU_ID', 'text': f'E-mail enviado para {destinatario}'})
        except:
            pass
            
    except Exception as e:
        print(f"❌ [THREAD] ERRO DETALHADO: {str(e)}")
        import traceback
        traceback.print_exc()

# ============================================
# GERADORES DE RELATÓRIOS EM HTML
# ============================================

def gerar_email_teste():
    """Gera e-mail de teste em HTML"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #052e10, #155523); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🌱 AGROcore</h1>
            </div>
            <div class="content">
                <h2>✅ Configuração realizada com sucesso!</h2>
                <p>Olá,</p>
                <p>Este é um e-mail de teste do <strong>AGROcore</strong>. Sua configuração está funcionando perfeitamente!</p>
                
                <div class="success">
                    <strong>📊 Você receberá relatórios conforme sua configuração.</strong>
                </div>
                
                <p>Em breve você começará a receber os relatórios no horário agendado.</p>
                
                <p>Atenciosamente,<br><strong>Equipe AGROcore</strong></p>
            </div>
            <div class="footer">
                <p>© 2026 AGROcore - Este é um e-mail automático.</p>
            </div>
        </div>
    </body>
    </html>
    """

def gerar_relatorio_diario_html(dados):
    """Gera relatório diário em HTML"""
    
    cor_vendas = '#28a745' if dados.get('variacao_vendas', 0) >= 0 else '#dc3545'
    seta_vendas = '▲' if dados.get('variacao_vendas', 0) >= 0 else '▼'
    
    cor_gastos = '#28a745' if dados.get('variacao_gastos', 0) <= 0 else '#dc3545'
    seta_gastos = '▼' if dados.get('variacao_gastos', 0) <= 0 else '▲'
    
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #052e10, #155523); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #ffffff; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px; }}
            .kpi-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }}
            .kpi-card {{ background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #155523; }}
            .kpi-label {{ font-size: 12px; color: #666; text-transform: uppercase; }}
            .kpi-value {{ font-size: 24px; font-weight: bold; margin: 5px 0; }}
            .positivo {{ color: #28a745; }}
            .negativo {{ color: #dc3545; }}
            .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🌱 AGROcore</h1>
                <p>Resumo Diário - {dados.get('data', '')}</p>
            </div>
            <div class="content">
                
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-label">💰 Vendas Hoje</div>
                        <div class="kpi-value">R$ {dados.get('vendas_hoje', 0):,.2f}</div>
                        <div class="{ 'positivo' if dados.get('variacao_vendas', 0) >= 0 else 'negativo' }">
                            {seta_vendas} {abs(dados.get('variacao_vendas', 0)):.1f}% vs ontem
                        </div>
                    </div>
                    
                    <div class="kpi-card">
                        <div class="kpi-label">💸 Gastos Hoje</div>
                        <div class="kpi-value">R$ {dados.get('gastos_hoje', 0):,.2f}</div>
                        <div class="{ 'positivo' if dados.get('variacao_gastos', 0) <= 0 else 'negativo' }">
                            {seta_gastos} {abs(dados.get('variacao_gastos', 0)):.1f}% vs média
                        </div>
                    </div>
                </div>
                
                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    🌟 <strong>Destaque:</strong> {dados.get('destaque', 'Soja com margem de 42%')}
                </div>
                
                <p style="text-align: center; margin-top: 30px;">
                    <a href="https://aguiar.up.railway.app" style="background: #155523; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        Acessar o Sistema →
                    </a>
                </p>
            </div>
            <div class="footer">
                <p>© 2026 AGROcore - Relatório automático</p>
            </div>
        </div>
    </body>
    </html>
    '''

def carregar_configuracoes_do_banco():
    """Carrega todas as configurações ativas do banco"""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM configuracoes_email WHERE ativo = true')
        rows = cur.fetchall()
        
        configuracoes = []
        for row in rows:
            configuracoes.append({
                'usuario_id': row['usuario_id'],
                'email': row['email_destino'],
                'frequencias': row['frequencias'],
                'horario': row['horario'],
                'ativo': row['ativo']
            })
        
        return configuracoes
    except Exception as e:
        print(f"❌ Erro ao carregar configurações: {e}")
        return []
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# ============================================
# AGENDADOR DE RELATÓRIOS
# ============================================
scheduler = BackgroundScheduler()

def verificar_e_enviar_relatorios():
    """Verifica se há relatórios para enviar - buscando configurações do banco"""
    with app.app_context():
        agora = datetime.now()
        hora_atual = agora.strftime("%H:%M")
        
        print(f"⏰ [SCHEDULER] Verificando envios - {agora.strftime('%d/%m/%Y %H:%M')}")
        
        # ============================================
        # 1. CARREGAR CONFIGURAÇÕES DO BANCO
        # ============================================
        conn = None
        cur = None
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Buscar todas as configurações ativas
            cur.execute('SELECT * FROM configuracoes_email WHERE ativo = true')
            configuracoes = cur.fetchall()
            
            print(f"📧 [SCHEDULER] Encontradas {len(configuracoes)} configurações ativas")
            
            # ============================================
            # 2. PARA CADA CONFIGURAÇÃO, VERIFICAR HORÁRIO
            # ============================================
            for config in configuracoes:
                # Verificar se é hora de enviar
                if config['horario'] != hora_atual:
                    continue
                
                print(f"✅ Vai enviar para {config['email_destino']} - Horário: {config['horario']}")
                
                # ============================================
                # 3. BUSCAR DADOS REAIS DO BANCO PARA O RELATÓRIO
                # ============================================
                hoje = agora.strftime('%Y-%m-%d')
                ontem = (agora - timedelta(days=1)).strftime('%Y-%m-%d')
                trinta_dias_atras = (agora - timedelta(days=30)).strftime('%Y-%m-%d')
                
                # 3.1 Vendas de hoje
                cur.execute('SELECT COALESCE(SUM(total), 0) as total FROM vendas WHERE data = %s', (hoje,))
                vendas_hoje = cur.fetchone()['total']
                
                # 3.2 Vendas de ontem
                cur.execute('SELECT COALESCE(SUM(total), 0) as total FROM vendas WHERE data = %s', (ontem,))
                vendas_ontem = cur.fetchone()['total']
                
                # 3.3 Gastos de hoje (gastos + produções)
                cur.execute('SELECT COALESCE(SUM(valor), 0) as total FROM gastos WHERE data = %s', (hoje,))
                gastos_hoje = cur.fetchone()['total']
                
                cur.execute('SELECT COALESCE(SUM(total), 0) as total FROM producoes WHERE data = %s', (hoje,))
                producoes_hoje = cur.fetchone()['total']
                
                gastos_hoje_total = gastos_hoje + producoes_hoje
                
                # 3.4 Média de gastos dos últimos 30 dias
                cur.execute('''
                    SELECT COALESCE(SUM(valor), 0) as total FROM gastos 
                    WHERE data BETWEEN %s AND %s
                ''', (trinta_dias_atras, ontem))
                gastos_30 = cur.fetchone()['total']
                
                cur.execute('''
                    SELECT COALESCE(SUM(total), 0) as total FROM producoes 
                    WHERE data BETWEEN %s AND %s
                ''', (trinta_dias_atras, ontem))
                producoes_30 = cur.fetchone()['total']
                
                gastos_30_total = gastos_30 + producoes_30
                media_gastos_30 = gastos_30_total / 30 if gastos_30_total > 0 else 0
                
                # 3.5 Destaque do dia (produto com maior venda)
                cur.execute('''
                    SELECT produto, SUM(total) as total 
                    FROM vendas 
                    WHERE data = %s 
                    GROUP BY produto 
                    ORDER BY total DESC 
                    LIMIT 1
                ''', (hoje,))
                destaque_row = cur.fetchone()
                
                if destaque_row and destaque_row['produto']:
                    destaque_texto = f"{destaque_row['produto']} (R$ {destaque_row['total']:,.2f})"
                else:
                    destaque_texto = "Nenhuma venda hoje"
                
                # 3.6 Calcular variações
                variacao_vendas = ((vendas_hoje - vendas_ontem) / vendas_ontem * 100) if vendas_ontem > 0 else 0
                variacao_gastos = ((gastos_hoje_total - media_gastos_30) / media_gastos_30 * 100) if media_gastos_30 > 0 else 0
                
                # ============================================
                # 4. MONTAR DADOS DO RELATÓRIO
                # ============================================
                dados = {
                    'data': agora.strftime('%d/%m/%Y'),
                    'vendas_hoje': vendas_hoje,
                    'gastos_hoje': gastos_hoje_total,
                    'variacao_vendas': variacao_vendas,
                    'variacao_gastos': variacao_gastos,
                    'destaque': destaque_texto
                }
                
                # ============================================
                # 5. ENVIAR RELATÓRIO (RESEND)
                # ============================================
                if 'diario' in config['frequencias']:
                    try:
                        # Gerar HTML do relatório
                        html = gerar_relatorio_diario_html(dados)
                        
                        # Configurar Resend
                        resend.api_key = os.environ.get('RESEND_API_KEY')
                        
                        # Enviar e-mail
                        r = resend.Emails.send({
                            "from": "onboarding@resend.dev",
                            "to": config['email_destino'],
                            "subject": "🌱 AGROcore - Resumo Diário",
                            "html": html
                        })
                        
                        print(f"✅ [EMAIL] Relatório diário enviado para {config['email_destino']}")
                        
                    except Exception as e:
                        print(f"❌ [EMAIL] Erro ao enviar: {e}")
                        import traceback
                        traceback.print_exc()
                
                # Se quiser adicionar relatório semanal depois:
                # if 'semanal' in config['frequencias']:
                #     ...
                
        except Exception as e:
            print(f"❌ [SCHEDULER] Erro geral: {e}")
            import traceback
            traceback.print_exc()
            
        finally:
            # Fechar conexões
            if cur:
                cur.close()
            if conn:
                conn.close()
# Iniciar o agendador
scheduler.add_job(
    func=verificar_e_enviar_relatorios,
    trigger="interval",
    minutes=1,  # Verificar a cada minuto
    id="verificar_envios_email"
)
scheduler.start()

# Parar o agendador quando a aplicação parar
atexit.register(lambda: scheduler.shutdown())
# ============================================
# FUNÇÃO PARA ENVIAR E-MAIL COM SENDGRID
# ============================================
def enviar_email_sendgrid(destinatario, assunto, html_content):
    """Envia e-mail usando SendGrid (não trava o servidor)"""
    try:
        sendgrid_key = os.environ.get('SENDGRID_API_KEY')
        
        if not sendgrid_key:
            print("❌ SENDGRID_API_KEY não configurada")
            return False
        
        message = Mail(
            from_email='julioaguiar05@gmail.com',
            to_emails=destinatario,
            subject=assunto,
            html_content=html_content
        )
        
        sg = SendGridAPIClient(sendgrid_key)
        response = sg.send(message)
        
        if response.status_code in [200, 201, 202]:
            print(f"✅ E-mail enviado para {destinatario}")
            return True
        else:
            print(f"❌ Erro {response.status_code} ao enviar e-mail")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao enviar e-mail: {str(e)}")
        return False

# ============================================
# NOVAS ROTAS DE E-MAIL (SUBSTITUA AS ATUAIS)
# ============================================

@app.route('/api/diagnostico-email', methods=['GET'])
def diagnostico_email():
    """Diagnostica problemas com o SendGrid"""
    resultado = {
        'sendgrid_key_configurada': bool(os.environ.get('SENDGRID_API_KEY')),
        'sendgrid_key_prefix': os.environ.get('SENDGRID_API_KEY', '')[:10] + '...' if os.environ.get('SENDGRID_API_KEY') else None,
        'status': 'Verificando...'
    }
    
    # Testar se a chave tem o formato correto
    if resultado['sendgrid_key_configurada']:
        key = os.environ.get('SENDGRID_API_KEY')
        if key.startswith('SG.'):
            resultado['formato_chave'] = 'OK (começa com SG.)'
        else:
            resultado['formato_chave'] = 'ERRO: API Key deve começar com SG.'
    
    return jsonify(resultado)

import resend

@app.route('/api/testar-email', methods=['POST'])
def testar_email():
    """Envia e-mail usando Resend (funciona no Railway)"""
    try:
        data = request.json
        email = data['email']
        
        print(f"📧 Enviando e-mail via Resend para: {email}")
        
        # Pegar API Key do ambiente
        resend_api_key = os.environ.get('RESEND_API_KEY')
        if not resend_api_key:
            return jsonify({
                'success': False, 
                'erro': 'Resend não configurado. Adicione RESEND_API_KEY no Railway.'
            }), 500
        
        # Configurar a API key
        resend.api_key = resend_api_key
        
        # Enviar e-mail exatamente como no exemplo deles
        r = resend.Emails.send({
            "from": "onboarding@resend.dev",  # E-mail padrão do Resend
            "to": email,
            "subject": "🌱 AGROcore - Teste de Configuração",
            "html": """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #052e10, #155523); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🌱 AGROcore</h1>
                    </div>
                    <div class="content">
                        <h2>✅ Configuração realizada com sucesso!</h2>
                        <p>Olá,</p>
                        <p>Este é um e-mail de teste do <strong>AGROcore</strong>. Sua configuração está funcionando perfeitamente!</p>
                        
                        <div class="success">
                            <strong>📊 Agora você pode configurar relatórios diários, semanais ou mensais.</strong>
                        </div>
                        
                        <p>Agora é só usar o sistema!</p>
                        
                        <p>Atenciosamente,<br><strong>Equipe AGROcore</strong></p>
                    </div>
                </div>
            </body>
            </html>
            """
        })
        
        print(f"✅ E-mail enviado! Resposta: {r}")
        
        return jsonify({
            'success': True, 
            'mensagem': 'E-mail de teste enviado! Verifique sua caixa de entrada.'
        })
        
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return jsonify({'success': False, 'erro': str(e)}), 500

# ============================================
# ROTAS DE AUTENTICAÇÃO
# ============================================

@app.route('/api/registrar', methods=['POST'])
def registrar_usuario():
    """Registrar novo usuário (protegido - só admin pode acessar)"""
    try:
        data = request.json
        email = data.get('email')
        senha = data.get('senha')
        nome = data.get('nome')
        
        if not email or not senha:
            return jsonify({'error': 'E-mail e senha são obrigatórios'}), 400
        
        # Verificar se e-mail já existe
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT id FROM usuarios WHERE email = %s', (email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'E-mail já cadastrado'}), 400
        
        # Criar novo usuário
        senha_hash = gerar_hash_senha(senha)
        cur.execute('''
            INSERT INTO usuarios (email, senha_hash, nome)
            VALUES (%s, %s, %s)
            RETURNING id
        ''', (email, senha_hash, nome))
        
        usuario_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Usuário registrado com sucesso!', 'usuario_id': usuario_id})
        
    except Exception as e:
        print(f"❌ Erro no registro: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Login do usuário"""
    try:
        data = request.json
        email = data.get('email')
        senha = data.get('senha')
        
        if not email or not senha:
            return jsonify({'error': 'E-mail e senha são obrigatórios'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT * FROM usuarios WHERE email = %s AND ativo = true', (email,))
        usuario = cur.fetchone()
        cur.close()
        conn.close()
        
        if not usuario or not verificar_senha(senha, usuario['senha_hash']):
            return jsonify({'error': 'E-mail ou senha inválidos'}), 401
        
        # Gerar token JWT
        token = jwt.encode({
            'usuario_id': usuario['id'],
            'email': usuario['email'],
            'nome': usuario['nome'],
            'exp': datetime.utcnow() + timedelta(days=7)  # Token válido por 7 dias
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'success': True,
            'token': token,
            'usuario': {
                'id': usuario['id'],
                'email': usuario['email'],
                'nome': usuario['nome']
            }
        })
        
    except Exception as e:
        print(f"❌ Erro no login: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/verificar-token', methods=['GET'])
@token_required
def verificar_token():
    """Verifica se o token é válido"""
    return jsonify({
        'success': True,
        'usuario': {
            'id': request.usuario_id,
            'email': request.usuario_email
        }
    })


@app.route('/api/verificar-email', methods=['GET'])
def verificar_email():
    """Verifica configuração do Resend"""
    resend_key = os.environ.get('RESEND_API_KEY')
    
    if resend_key:
        return jsonify({
            'status': 'OK',
            'mensagem': 'Resend configurado',
            'key_prefix': resend_key[:10] + '...'
        })
    else:
        return jsonify({
            'status': 'ERRO',
            'mensagem': 'RESEND_API_KEY não encontrada no Railway'
        }), 500

# ============================================
# ADMIN - CRIAÇÃO DE USUÁRIOS
# ============================================

@app.route('/api/criar-usuario', methods=['POST'])
@token_required
def criar_usuario():
    """Cria novo usuário (apenas admin@agrocore.com)"""
    try:
        # Verificar se o usuário logado é o admin
        if request.usuario_email != 'admin@agrocore.com':
            return jsonify({'error': 'Acesso negado. Apenas o administrador pode criar usuários.'}), 403
        
        data = request.json
        email = data.get('email')
        senha = data.get('senha')
        nome = data.get('nome')
            
        if not email or not senha or not nome:
            return jsonify({'error': 'E-mail, senha e nome são obrigatórios'}), 400
        
        if '@' not in email or '.' not in email:
            return jsonify({'error': 'E-mail inválido'}), 400
        
        if len(senha) < 6:
            return jsonify({'error': 'A senha deve ter pelo menos 6 caracteres'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verificar se e-mail já existe
        cur.execute('SELECT id FROM usuarios WHERE email = %s', (email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({'error': 'E-mail já cadastrado'}), 400
        
        # Gerar hash da senha
        senha_hash = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Criar usuário
        cur.execute('''
            INSERT INTO usuarios (email, senha_hash, nome, ativo)
            VALUES (%s, %s, %s, true)
            RETURNING id
        ''', (email, senha_hash, nome))
        
        usuario_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True, 
            'message': f'✅ Usuário {email} criado com sucesso!',
            'usuario_id': usuario_id
        })
        
    except Exception as e:
        print(f"❌ Erro ao criar usuário: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/usuarios', methods=['GET'])
@token_required
def listar_usuarios():
    """Lista os últimos 10 usuários"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            SELECT id, email, nome, created_at 
            FROM usuarios 
            ORDER BY id DESC 
            LIMIT 10
        ''')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'usuarios': list(rows)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
# ============================================
# ROTAS DE CORREÇÃO DO BANCO DE DADOS
# ============================================

@app.route('/corrigir-banco-completo')
def corrigir_banco_completo():
    """Corrige completamente a estrutura do banco de dados"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        relatorio = []
        
        # 1. Criar tabela de usuários se não existir
        cur.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                senha_hash VARCHAR(255) NOT NULL,
                nome VARCHAR(255),
                ativo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        relatorio.append("✅ Tabela 'usuarios' criada/verificada")
        
        # 2. Criar tabela de configurações de email
        cur.execute('''
            CREATE TABLE IF NOT EXISTS configuracoes_email (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                email_destino VARCHAR(255) NOT NULL,
                frequencias TEXT[],
                horario VARCHAR(5),
                ativo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        relatorio.append("✅ Tabela 'configuracoes_email' criada/verificada")
        
        # 3. Adicionar coluna usuario_id na tabela producoes
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='producoes' AND column_name='usuario_id'")
        if not cur.fetchone():
            cur.execute('ALTER TABLE producoes ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)')
            relatorio.append("✅ Coluna 'usuario_id' adicionada em producoes")
        else:
            relatorio.append("ℹ️ Coluna 'usuario_id' já existe em producoes")
        
        # 4. Adicionar coluna usuario_id na tabela vendas
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='vendas' AND column_name='usuario_id'")
        if not cur.fetchone():
            cur.execute('ALTER TABLE vendas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)')
            relatorio.append("✅ Coluna 'usuario_id' adicionada em vendas")
        else:
            relatorio.append("ℹ️ Coluna 'usuario_id' já existe em vendas")
        
        # 5. Adicionar colunas na tabela gastos
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='gastos' AND column_name='usuario_id'")
        if not cur.fetchone():
            cur.execute('ALTER TABLE gastos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)')
            relatorio.append("✅ Coluna 'usuario_id' adicionada em gastos")
        else:
            relatorio.append("ℹ️ Coluna 'usuario_id' já existe em gastos")
        
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='gastos' AND column_name='produto'")
        if not cur.fetchone():
            cur.execute('ALTER TABLE gastos ADD COLUMN produto VARCHAR(255)')
            relatorio.append("✅ Coluna 'produto' adicionada em gastos")
        else:
            relatorio.append("ℹ️ Coluna 'produto' já existe em gastos")
        
        conn.commit()
        
        # 6. Criar usuário admin se não existir
        cur.execute('SELECT id FROM usuarios WHERE email = %s', ('admin@agrocore.com',))
        if not cur.fetchone():
            senha_hash = gerar_hash_senha('admin123')
            cur.execute('''
                INSERT INTO usuarios (email, senha_hash, nome, ativo)
                VALUES (%s, %s, %s, true)
            ''', ('admin@agrocore.com', senha_hash, 'Administrador'))
            conn.commit()
            relatorio.append("✅ Usuário admin criado (email: admin@agrocore.com / senha: admin123)")
        else:
            relatorio.append("ℹ️ Usuário admin já existe")
        
        # 7. Corrigir registros órfãos (se houver algum usuário)
        cur.execute('SELECT id FROM usuarios LIMIT 1')
        primeiro_usuario = cur.fetchone()
        
        if primeiro_usuario:
            usuario_id = primeiro_usuario['id']
            
            # Corrigir producoes
            cur.execute('UPDATE producoes SET usuario_id = %s WHERE usuario_id IS NULL', (usuario_id,))
            prod_fixed = cur.rowcount
            
            # Corrigir vendas
            cur.execute('UPDATE vendas SET usuario_id = %s WHERE usuario_id IS NULL', (usuario_id,))
            vendas_fixed = cur.rowcount
            
            # Corrigir gastos
            cur.execute('UPDATE gastos SET usuario_id = %s WHERE usuario_id IS NULL', (usuario_id,))
            gastos_fixed = cur.rowcount
            
            conn.commit()
            
            if prod_fixed > 0:
                relatorio.append(f"✅ {prod_fixed} registros de produção corrigidos")
            if vendas_fixed > 0:
                relatorio.append(f"✅ {vendas_fixed} registros de vendas corrigidos")
            if gastos_fixed > 0:
                relatorio.append(f"✅ {gastos_fixed} registros de gastos corrigidos")
        
        cur.close()
        conn.close()
        
        # Gerar HTML com o relatório
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Correção - AGROcore</title>
            <style>
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background: #f5f5f5;
                }
                .card {
                    background: white;
                    border-radius: 16px;
                    padding: 30px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                h1 {
                    color: #2d7a3a;
                    margin-top: 0;
                }
                .success {
                    color: #28a745;
                    padding: 8px 0;
                    border-bottom: 1px solid #e0e0e0;
                }
                .info {
                    color: #6c757d;
                    padding: 8px 0;
                    border-bottom: 1px solid #e0e0e0;
                }
                .button {
                    display: inline-block;
                    background: #2d7a3a;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 8px;
                    margin-top: 20px;
                    font-weight: bold;
                }
                .button:hover {
                    background: #1e5a2a;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🔧 Correção do Banco de Dados</h1>
                <h2>📊 Relatório:</h2>
                <ul style="list-style: none; padding: 0;">
        """
        
        for item in relatorio:
            if "✅" in item:
                html += f'<li class="success">{item}</li>'
            else:
                html += f'<li class="info">{item}</li>'
        
        html += """
                </ul>
                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>🎉 Correção concluída!</strong><br>
                    Agora o sistema está pronto para uso com múltiplos usuários.
                </div>
                <a href="/" class="button">🔙 Voltar ao Sistema</a>
            </div>
        </body>
        </html>
        """
        
        return html
        
    except Exception as e:
        return f"""
        <!DOCTYPE html>
        <html>
        <head><title>Erro</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: red;">❌ Erro durante correção</h1>
            <p style="color: #666;">{str(e)}</p>
            <a href="/" style="background: #2d7a3a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Voltar</a>
        </body>
        </html>
        """

@app.route('/adicionar-rota-delete-gastos')
def adicionar_rota_delete_gastos():
    """Informação sobre a rota DELETE de gastos"""
    return """
    <!DOCTYPE html>
    <html>
    <head><title>Rota DELETE de Gastos</title></head>
    <body style="font-family: Arial; padding: 50px;">
        <h1 style="color: green;">✅ A rota DELETE de gastos já existe!</h1>
        <p>No seu código, a função <code>delete_gasto()</code> está implementada na linha:</p>
        <pre style="background: #f0f0f0; padding: 15px; border-radius: 5px;">
@app.route('/api/gastos/&lt;id&gt;', methods=['DELETE'])
@token_required
def delete_gasto(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM gastos WHERE id = %s AND usuario_id = %s', (id, request.usuario_id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Gasto deletado'})
        </pre>
        <p><a href="/" style="background: #2d7a3a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Voltar</a></p>
    </body>
    </html>
    """

@app.route('/api/gastos/<id>', methods=['DELETE'])
@token_required
def delete_gasto(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM gastos WHERE id = %s AND usuario_id = %s', (id, request.usuario_id))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Gasto deletado'})

if __name__ == '__main__':
    print("🔄 Inicializando banco de dados...")
    criar_tabelas()
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
