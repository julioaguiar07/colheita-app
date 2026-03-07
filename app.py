from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
import os
from datetime import datetime
import urllib.parse as urlparse

app = Flask(__name__, static_folder='static')
CORS(app)

# Configuração do banco de dados
def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    
    # Railway fornece a URL do banco diretamente
    if database_url:
        # Se for Railway, já vem com o formato correto
        conn = psycopg2.connect(database_url)
    else:
        # Configuração local para desenvolvimento
        conn = psycopg2.connect(
            host='localhost',
            database='colheita',
            user='postgres',
            password='postgres'
        )
    return conn

# Criar tabelas
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
            total DECIMAL(10,2)
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
            obs TEXT
        )
    ''')
    
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Tabelas criadas/verificadas com sucesso!")

# Rota para servir o HTML
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
    
    # Converter para lista de dicionários
    producoes = []
    for row in rows:
        producoes.append({
            'id': row[0],
            'data': str(row[1]),
            'nome': row[2],
            'produto': row[3],
            'area': row[4],
            'unidade': row[5],
            'qtd': float(row[6]) if row[6] else 0,
            'valor': float(row[7]) if row[7] else 0,
            'total': float(row[8]) if row[8] else 0
        })
    
    cur.close()
    conn.close()
    return jsonify(producoes)

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

# ========== API DIÁRIAS ==========
@app.route('/api/diarias', methods=['GET'])
def get_diarias():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM diarias ORDER BY data DESC')
    rows = cur.fetchall()
    
    diarias = []
    for row in rows:
        diarias.append({
            'id': row[0],
            'data': str(row[1]),
            'nome': row[2],
            'area': row[3],
            'tipo': float(row[4]) if row[4] else 0,
            'obs': row[5]
        })
    
    cur.close()
    conn.close()
    return jsonify(diarias)

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

if __name__ == '__main__':
    init_database()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
