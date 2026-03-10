#!/bin/bash
# Vino服务 - 检查运行状态

SSH_KEY="F:/ItsyourTurnMy/backend/deploy/test.pem"
SERVER="ubuntu@106.54.50.88"
SSH_OPTS="-o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no"

echo "=== Vino 容器状态 ==="
ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo docker ps --filter 'name=vino' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo "=== 后端日志 (最后20行) ==="
ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo docker logs --tail 20 vino-backend 2>&1"

echo ""
echo "=== 前端日志 (最后10行) ==="
ssh $SSH_OPTS -i "$SSH_KEY" $SERVER "sudo docker logs --tail 10 vino-frontend 2>&1"
