from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime, timedelta
import json

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

# Criar todas as tabelas
def init_database():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Tabela de produções
    cur.execute('''
        CREATE TABLE IF NOT EXISTS producoes (
            id VARCHAR(50) PRIMARY KEY,
            data DATE NOT NULL,
            nome VARCHAR(255) NOT NULL,
            produto VARCHAR(255) NOT NULL,
            area VARCHAR(255),
            unidade VARCHAR(50),
            qtd DECIMAL(10,2),
            valor DECIMAL(10,2),
            total DECIMAL(10,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabela de diárias
    cur.execute('''
        CREATE TABLE IF NOT EXISTS diarias (
            id VARCHAR(50) PRIMARY KEY,
            data DATE NOT NULL,
            nome VARCHAR(255) NOT NULL,
            area VARCHAR(255),
            tipo DECIMAL(10,2),
            obs TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # NOVA TABELA: Gastos
    cur.execute('''
        CREATE TABLE IF NOT EXISTS gastos (
            id VARCHAR(50) PRIMARY KEY,
            data DATE NOT NULL,
            tipo VARCHAR(100) NOT NULL,
            descricao TEXT,
            valor DECIMAL(10,2) NOT NULL,
            area VARCHAR(255),
            categoria VARCHAR(50) DEFAULT 'outros',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # NOVA TABELA: Categorias de gasto
    cur.execute('''
        CREATE TABLE IF NOT EXISTS categorias_gasto (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) UNIQUE NOT NULL,
            icone VARCHAR(10) DEFAULT '💰',
            cor VARCHAR(20) DEFAULT '#f0b429'
        )
    ''')
    
    # Inserir categorias padrão se não existirem
    cur.execute('''
        INSERT INTO categorias_gasto (nome, icone, cor) VALUES
        ('Combustível', '⛽', '#dc2626'),
        ('Manutenção', '🔧', '#2563eb'),
        ('Insumos', '🌱', '#16a34a'),
        ('Mão de obra', '👷', '#9333ea'),
        ('Transporte', '🚜', '#ea580c'),
        ('Outros', '💰', '#6b7280')
        ON CONFLICT (nome) DO NOTHING
    ''')
    
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Todas as tabelas criadas/verificadas com sucesso!")

# Rota principal
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# ========== API PRODUÇÕES (mantida igual) ==========
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
        INSERT INTO producoes (id, data, nome, produto, area, unidade, qtd, valor, total)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['nome'], data['produto'], 
        data.get('area', ''), data['unidade'], data['qtd'], 
        data['valor'], data['total']
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Produção criada com sucesso!'}), 201

@app.route('/api/producoes/<id>', methods=['PUT'])
def update_producao(id):
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE producoes 
        SET data=%s, nome=%s, produto=%s, area=%s, unidade=%s, qtd=%s, valor=%s, total=%s
        WHERE id=%s
    ''', (
        data['data'], data['nome'], data['produto'], data.get('area', ''),
        data['unidade'], data['qtd'], data['valor'], data['total'], id
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Produção atualizada com sucesso!'})

@app.route('/api/producoes/<id>', methods=['DELETE'])
def delete_producao(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM producoes WHERE id = %s', (id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Produção deletada com sucesso!'})

# ========== API DIÁRIAS (mantida igual) ==========
@app.route('/api/diarias', methods=['GET'])
def get_diarias():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM diarias ORDER BY data DESC')
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(list(rows))

@app.route('/api/diarias', methods=['POST'])
def create_diaria():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO diarias (id, data, nome, area, tipo, obs)
        VALUES (%s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['nome'], 
        data.get('area', ''), data['tipo'], data.get('obs', '')
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Diária criada com sucesso!'}), 201

@app.route('/api/diarias/<id>', methods=['PUT'])
def update_diaria(id):
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE diarias 
        SET data=%s, nome=%s, area=%s, tipo=%s, obs=%s
        WHERE id=%s
    ''', (
        data['data'], data['nome'], data.get('area', ''),
        data['tipo'], data.get('obs', ''), id
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Diária atualizada com sucesso!'})

@app.route('/api/diarias/<id>', methods=['DELETE'])
def delete_diaria(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM diarias WHERE id = %s', (id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Diária deletada com sucesso!'})

# ========== NOVA API: GASTOS ==========
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
        INSERT INTO gastos (id, data, tipo, descricao, valor, area, categoria)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    ''', (
        data['id'], data['data'], data['tipo'], 
        data.get('descricao', ''), data['valor'], 
        data.get('area', ''), data.get('categoria', 'outros')
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Gasto criado com sucesso!'}), 201

@app.route('/api/gastos/<id>', methods=['PUT'])
def update_gasto(id):
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE gastos 
        SET data=%s, tipo=%s, descricao=%s, valor=%s, area=%s, categoria=%s
        WHERE id=%s
    ''', (
        data['data'], data['tipo'], data.get('descricao', ''),
        data['valor'], data.get('area', ''), data.get('categoria', 'outros'), id
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Gasto atualizado com sucesso!'})

@app.route('/api/gastos/<id>', methods=['DELETE'])
def delete_gasto(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM gastos WHERE id = %s', (id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Gasto deletado com sucesso!'})

# ========== NOVA API: CATEGORIAS DE GASTO ==========
@app.route('/api/categorias-gasto', methods=['GET'])
def get_categorias():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM categorias_gasto ORDER BY nome')
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(list(rows))

# ========== NOVA API: DASHBOARD COMPLETO ==========
@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Período (últimos 30 dias por padrão)
    data_fim = datetime.now().date()
    data_ini = data_fim - timedelta(days=30)
    
    # Totais gerais
    cur.execute('SELECT COALESCE(SUM(total), 0) as total FROM producoes')
    total_prod = cur.fetchone()['total']
    
    cur.execute('SELECT COALESCE(SUM(tipo), 0) as total FROM diarias')
    total_diarias = cur.fetchone()['total']
    
    cur.execute('SELECT COALESCE(SUM(valor), 0) as total FROM gastos')
    total_gastos = cur.fetchone()['total']
    
    # Lucro líquido
    lucro_liquido = total_prod + total_diarias - total_gastos
    
    # Gastos por categoria
    cur.execute('''
        SELECT c.nome, c.icone, c.cor, COALESCE(SUM(g.valor), 0) as total
        FROM categorias_gasto c
        LEFT JOIN gastos g ON g.categoria = c.nome
        GROUP BY c.nome, c.icone, c.cor
        ORDER BY total DESC
    ''')
    gastos_categoria = cur.fetchall()
    
    # Top produtos
    cur.execute('''
        SELECT produto, SUM(qtd) as qtd_total, SUM(total) as valor_total
        FROM producoes
        GROUP BY produto
        ORDER BY valor_total DESC
        LIMIT 5
    ''')
    top_produtos = cur.fetchall()
    
    # Produção vs Gastos por área
    cur.execute('''
        SELECT 
            COALESCE(p.area, g.area) as area,
            COALESCE(SUM(DISTINCT p.total), 0) as total_producao,
            COALESCE(SUM(DISTINCT d.tipo), 0) as total_diarias,
            COALESCE(SUM(DISTINCT g.valor), 0) as total_gastos
        FROM (
            SELECT DISTINCT area FROM producoes
            UNION
            SELECT DISTINCT area FROM diarias
            UNION
            SELECT DISTINCT area FROM gastos
        ) areas
        LEFT JOIN producoes p ON p.area = areas.area
        LEFT JOIN diarias d ON d.area = areas.area
        LEFT JOIN gastos g ON g.area = areas.area
        WHERE areas.area IS NOT NULL AND areas.area != ''
        GROUP BY areas.area
    ''')
    areas_detalhado = cur.fetchall()
    
    # Evolução mensal (últimos 6 meses)
    cur.execute('''
        SELECT 
            TO_CHAR(data, 'YYYY-MM') as mes,
            SUM(CASE WHEN table_name = 'producoes' THEN total ELSE 0 END) as producao,
            SUM(CASE WHEN table_name = 'diarias' THEN tipo ELSE 0 END) as diarias,
            SUM(CASE WHEN table_name = 'gastos' THEN valor ELSE 0 END) as gastos
        FROM (
            SELECT data, total, NULL as tipo, NULL as valor, 'producoes' as table_name FROM producoes
            UNION ALL
            SELECT data, NULL, tipo, NULL, 'diarias' FROM diarias
            UNION ALL
            SELECT data, NULL, NULL, valor, 'gastos' FROM gastos
        ) todos
        WHERE data >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY TO_CHAR(data, 'YYYY-MM')
        ORDER BY mes
    ''')
    evolucao = cur.fetchall()
    
    # Indicadores de eficiência
    total_receita = total_prod + total_diarias
    margem_lucro = (lucro_liquido / total_receita * 100) if total_receita > 0 else 0
    
    cur.close()
    conn.close()
    
    return jsonify({
        'totais': {
            'producao': float(total_prod),
            'diarias': float(total_diarias),
            'gastos': float(total_gastos),
            'lucro_liquido': float(lucro_liquido),
            'margem_lucro': float(margem_lucro)
        },
        'gastos_categoria': gastos_categoria,
        'top_produtos': top_produtos,
        'areas_detalhado': areas_detalhado,
        'evolucao': evolucao
    })

if __name__ == '__main__':
    init_database()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
