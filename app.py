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

app = Flask(__name__, static_folder='static')
CORS(app)

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
        
        # Tabela de produções (custos de produção)
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✅ Tabela 'vendas' criada/verificada")
        
        # Tabela de gastos (com campo obs)
        cur.execute('''
            CREATE TABLE IF NOT EXISTS gastos (
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
        print("✅ Tabela 'gastos' criada/verificada")
        
        conn.commit()
        print("🎉 Todas as tabelas criadas com sucesso!")
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
def get_producoes():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM producoes ORDER BY data DESC')
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(list(rows))

@app.route('/api/producoes', methods=['POST'])
def create_producao():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO producoes (id, data, produto, tipo, area, qtd, unidade, valor_unit, total)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['produto'], data['tipo'],
        data.get('area', ''), data.get('qtd', 0), data.get('unidade', ''),
        data.get('valorUnit', 0), data['total']
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Produção criada'}), 201

@app.route('/api/producoes/<id>', methods=['DELETE'])
def delete_producao(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM producoes WHERE id = %s', (id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Produção deletada'})

# ========== API VENDAS ==========
@app.route('/api/vendas', methods=['GET'])
def get_vendas():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM vendas ORDER BY data DESC')
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(list(rows))

@app.route('/api/vendas', methods=['POST'])
def create_venda():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO vendas (id, data, produto, cliente, area, unidade, qtd, valor_unit, total)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['produto'], 
        data.get('cliente', ''), data.get('area', ''), 
        data['unidade'], data['qtd'], data['valorUnit'], data['total']
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Venda criada'}), 201

@app.route('/api/vendas/<id>', methods=['DELETE'])
def delete_venda(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM vendas WHERE id = %s', (id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Venda deletada'})

# ========== API GASTOS (COM PRODUTO) ==========
@app.route('/api/gastos', methods=['GET'])
def get_gastos():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM gastos ORDER BY data DESC')
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(list(rows))

@app.route('/api/gastos', methods=['POST'])
def create_gasto():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO gastos (id, data, tipo, categoria, produto, area, obs, valor)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], 
        data['data'], 
        data['tipo'], 
        data.get('categoria', 'Outros'), 
        data.get('produto', ''),  # ← NOVO CAMPO
        data.get('area', ''), 
        data.get('obs', ''), 
        data['valor']
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Gasto criado'}), 201

@app.route('/api/gastos/<id>', methods=['DELETE'])
def delete_gasto(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM gastos WHERE id = %s', (id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Gasto deletado'})

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
# ARMAZENAMENTO DAS CONFIGURAÇÕES DE E-MAIL
# ============================================
# Em produção, use o banco de dados. Por enquanto, usaremos um dicionário
configuracoes_email = {}

# ============================================
# ROTAS DE E-MAIL
# ============================================

@app.route('/api/config-email', methods=['POST'])
def config_email():
    """Salva as configurações de e-mail do usuário"""
    try:
        data = request.json
        usuario_id = request.remote_addr
        
        # Log para debug
        print(f"📧 Configuração recebida: {data}")
        
        # Salvar em memória (simples)
        configuracoes_email[usuario_id] = {
            'email': data['email'],
            'frequencias': data['frequencias'],
            'horario': data['horario'],
            'ativo': True
        }
        
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

@app.route('/api/testar-email-simples', methods=['GET'])
def testar_email_simples():
    """Rota de teste GET para verificar configuração"""
    try:
        email_user = os.environ.get('EMAIL_USER')
        email_password = os.environ.get('EMAIL_PASSWORD')
        
        resultado = {
            'email_user': email_user,
            'senha_configurada': bool(email_password),
            'tamanho_senha': len(email_password) if email_password else 0,
            'status': 'Verificando...'
        }
        
        # Testar conexão SMTP
        import smtplib
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(email_user, email_password)
        server.quit()
        
        resultado['status'] = 'Conexão SMTP OK!'
        
        return jsonify(resultado)
        
    except Exception as e:
        return jsonify({'erro': str(e), 'detalhes': resultado}), 500


@app.route('/api/testar-email', methods=['POST'])
def testar_email():
    """Envia e-mail de teste de forma assíncrona (não trava)"""
    try:
        data = request.json
        email = data['email']
        
        print(f"📧 Iniciando envio para: {email}")
        
        # Verificar credenciais
        email_user = os.environ.get('EMAIL_USER')
        email_password = os.environ.get('EMAIL_PASSWORD')
        
        if not email_user or not email_password:
            return jsonify({'success': False, 'erro': 'Credenciais não configuradas'}), 500
        
        # Criar thread para enviar e-mail em segundo plano
        thread = threading.Thread(target=enviar_email_async, args=(email,))
        thread.daemon = True  # A thread morre quando o servidor morre
        thread.start()
        
        # Responder imediatamente (não espera o e-mail ser enviado)
        return jsonify({
            'success': True, 
            'mensagem': 'E-mail sendo enviado em segundo plano. Pode levar alguns segundos.'
        })
    
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return jsonify({'success': False, 'erro': str(e)}), 500

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

# ============================================
# AGENDADOR DE RELATÓRIOS
# ============================================
scheduler = BackgroundScheduler()

def verificar_e_enviar_relatorios():
    """Verifica se há relatórios para enviar"""
    with app.app_context():
        agora = datetime.now()
        hora_atual = agora.strftime("%H:%M")
        
        for usuario_id, config in configuracoes_email.items():
            if not config.get('ativo', True):
                continue
                
            if config['horario'] != hora_atual:
                continue
            
            # Dados de exemplo (depois você vai buscar do banco)
            dados = {
                'data': agora.strftime('%d/%m/%Y'),
                'vendas_hoje': 3240.50,
                'gastos_hoje': 1150.00,
                'variacao_vendas': 15.2,
                'variacao_gastos': -8.5,
                'destaque': 'Soja com margem de 42%'
            }
            
            # Enviar relatório diário
            if 'diario' in config['frequencias']:
                try:
                    msg = Message(
                        subject="🌱 AGROcore - Resumo Diário",
                        recipients=[config['email']],
                        html=gerar_relatorio_diario_html(dados)
                    )
                    mail.send(msg)
                    print(f"[EMAIL] Relatório diário enviado para {config['email']}")
                except Exception as e:
                    print(f"[EMAIL] Erro ao enviar: {e}")

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

if __name__ == '__main__':
    print("🔄 Inicializando banco de dados...")
    criar_tabelas()
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
