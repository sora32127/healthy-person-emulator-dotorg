#!/bin/bash

# Node.js バージョンの確認
if ! command -v node &> /dev/null; then
    echo -e "\033[31mNode.js がインストールされていません。\033[0m"
    echo -e "Node.js のインストール方法については以下のリンクを参照してください："
    echo -e "https://nodejs.org/ja/download/"
    exit 1
else
    node_version=$(node -v)
    if ! [[ "$node_version" =~ ^v([1][8-9]|[2-9][0-9])\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "\033[31mNode.js 18.0.0以上がインストールされていません。Remixの動作には、Node.jsの18.0.0以上が必要です。"
        exit 1
    fi
fi

# Dockerデーモンの確認
if ! command -v docker &> /dev/null; then
    echo -e "\033[31mDockerがインストールされていません。Dockerをインストールして起動してください。\033[0m"
    echo -e "Dockerのインストール方法については以下のリンクを参照してください:"
    echo -e "https://docs.docker.com/get-docker/"
    exit 1
else
    if ! docker info > /dev/null 2>&1; then
        echo -e "\033[31mDockerデーモンが起動していません。Supabaseの動作にはDockerが必要になります。Dockerを起動してください。\033[0m"
        exit 1
    fi
fi

npm install
npx supabase init
npx supabase start
touch .env
supabase status | awk '/API URL/ {print "SUPABASE_URL="$NF} /anon key/ {print "SUPABASE_ANON_KEY="$NF} /service_role key/ {print "SUPABASE_SERVICE_ROLE_KEY="$NF} /DB URL/ {print "SUPABASE_CONNECTION_STRING="$NF}' > .env
npx prisma db push
