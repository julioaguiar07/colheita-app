from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='static')
CORS(app)

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
@app.route('/init-db')
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

if __name__ == '__main__':
    print("🔄 Inicializando banco de dados...")
    criar_tabelas()
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
