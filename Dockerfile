FROM python:3.11-slim

# Instalar dependências do sistema necessárias para o psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de requisitos primeiro (para melhor cache do Docker)
COPY requirements.txt .

# Instalar dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o resto da aplicação
COPY . .

# Expor a porta que a aplicação vai usar
EXPOSE 8080

# Comando para rodar a aplicação
CMD gunicorn app:app --bind 0.0.0.0:8080
