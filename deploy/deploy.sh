#!/bin/bash
# Vino服务 - 腾讯云部署脚本
# 服务器: 106.54.50.88
# 端口: 前端5201, 后端5202, MySQL3308

set -e

SSH_KEY="F:/ItsyourTurnMy/backend/deploy/test.pem"
SERVER="ubuntu@106.54.50.88"
SSH_OPTS="-o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no"
REMOTE_PATH="/root/Vino_test"

echo "========================================="
echo "  Vino服务 - 部署到腾讯云"
echo "========================================="

echo "[1/4] 创建远程目录..."
ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo mkdir -p $REMOTE_PATH"

echo "[2/4] 上传文件..."
# 打包项目（排除 node_modules）
cd "$(dirname "$0")/.."
tar --exclude='node_modules' --exclude='.git' --exclude='*.pem' -czf /tmp/vino-deploy.tar.gz .

scp $SSH_OPTS -i "$SSH_KEY" /tmp/vino-deploy.tar.gz $SERVER:/tmp/vino-deploy.tar.gz
ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo bash -c 'cd $REMOTE_PATH && tar -xzf /tmp/vino-deploy.tar.gz'"

echo "[3/4] 构建并启动容器..."
ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo bash -c 'cd $REMOTE_PATH && docker compose down 2>/dev/null; docker compose up -d --build'"

echo "[4/4] 检查容器状态..."
sleep 5
ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo docker ps --filter 'name=vino'"

echo ""
echo "========================================="
echo "  部署完成!"
echo "  前端: http://106.54.50.88:5201"
echo "  后端: http://106.54.50.88:5202/api/health"
echo "========================================="
