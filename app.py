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
        # Railway fornece a URL
        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
    else:
        # Desenvolvimento local
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
        
        # Tabela de produções (colheita)
        cur.execute('''
            CREATE TABLE IF NOT EXISTS producoes (
                id VARCHAR(50) PRIMARY KEY,
                data DATE NOT NULL,
                produto VARCHAR(255) NOT NULL,
                area VARCHAR(255),
                unidade VARCHAR(50),
                qtd DECIMAL(10,2),
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
        
        # Tabela de gastos
        cur.execute('''
            CREATE TABLE IF NOT EXISTS gastos (
                id VARCHAR(50) PRIMARY KEY,
                data DATE NOT NULL,
                tipo VARCHAR(255) NOT NULL,
                categoria VARCHAR(50),
                area VARCHAR(255),
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

# Rota para criar as tabelas manualmente (acessar via navegador)
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
        INSERT INTO producoes (id, data, produto, area, unidade, qtd, valor_unit, total)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['produto'], 
        data.get('area', ''), data['unidade'], 
        data['qtd'], data['valorUnit'], data['total']
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

# ========== API GASTOS ==========
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
        INSERT INTO gastos (id, data, tipo, categoria, area, valor)
        VALUES (%s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['tipo'], 
        data.get('categoria', 'Outros'), data.get('area', ''), 
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

# ========== API DASHBOARD ==========
@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Totais
    cur.execute('SELECT COALESCE(SUM(total), 0) as total FROM producoes')
    total_prod = cur.fetchone()['total']
    
    cur.execute('SELECT COALESCE(SUM(total), 0) as total FROM vendas')
    total_vendas = cur.fetchone()['total']
    
    cur.execute('SELECT COALESCE(SUM(valor), 0) as total FROM gastos')
    total_gastos = cur.fetchone()['total']
    
    # Últimos 6 meses para evolução
    cur.execute('''
        SELECT 
            TO_CHAR(data, 'YYYY-MM') as mes,
            SUM(CASE WHEN tabela = 'vendas' THEN total ELSE 0 END) as vendas,
            SUM(CASE WHEN tabela = 'gastos' THEN valor ELSE 0 END) as gastos
        FROM (
            SELECT data, total, NULL as valor, 'vendas' as tabela FROM vendas
            UNION ALL
            SELECT data, NULL, valor, 'gastos' as tabela FROM gastos
        ) todos
        WHERE data >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY TO_CHAR(data, 'YYYY-MM')
        ORDER BY mes
    ''')
    evolucao = cur.fetchall()
    
    # Gastos por categoria
    cur.execute('''
        SELECT categoria, COALESCE(SUM(valor), 0) as total
        FROM gastos
        GROUP BY categoria
        ORDER BY total DESC
    ''')
    gastos_categoria = cur.fetchall()
    
    # Top produtos (vendas)
    cur.execute('''
        SELECT produto, SUM(total) as total
        FROM vendas
        GROUP BY produto
        ORDER BY total DESC
        LIMIT 5
    ''')
    top_produtos = cur.fetchall()
    
    # Análise por área
    cur.execute('''
        SELECT 
            COALESCE(v.area, g.area) as area,
            COALESCE(SUM(DISTINCT v.total), 0) as vendas,
            COALESCE(SUM(DISTINCT g.valor), 0) as gastos
        FROM (
            SELECT DISTINCT area FROM vendas
            UNION
            SELECT DISTINCT area FROM gastos
        ) areas
        LEFT JOIN vendas v ON v.area = areas.area
        LEFT JOIN gastos g ON g.area = areas.area
        WHERE areas.area IS NOT NULL AND areas.area != ''
        GROUP BY areas.area
    ''')
    areas = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify({
        'totais': {
            'producao': float(total_prod),
            'vendas': float(total_vendas),
            'gastos': float(total_gastos),
            'lucro': float(total_vendas - total_gastos)
        },
        'evolucao': evolucao,
        'gastos_categoria': gastos_categoria,
        'top_produtos': top_produtos,
        'areas': areas
    })

if __name__ == '__main__':
    # Tenta criar as tabelas na inicialização
    print("🔄 Inicializando banco de dados...")
    criar_tabelas()
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
