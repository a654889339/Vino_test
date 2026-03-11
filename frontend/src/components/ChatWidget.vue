<template>
  <div class="chat-widget">
    <!-- Floating Button -->
    <div class="chat-fab" @click="toggleChat">
      <van-icon name="chat-o" size="24" color="#fff" />
      <div v-if="unreadCount > 0" class="chat-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</div>
    </div>

    <!-- Chat Panel -->
    <van-popup v-model:show="showChat" position="bottom" round :style="{ height: '75vh' }" @open="onOpen">
      <div class="chat-panel">
        <div class="chat-header">
          <span class="chat-title">在线客服</span>
          <van-icon name="cross" size="20" color="#999" class="chat-close" @click="showChat = false" />
        </div>

        <div class="chat-body" ref="chatBody">
          <div v-if="loading" style="text-align:center;padding:40px"><van-loading size="24" /></div>
          <template v-else>
            <div v-if="!messages.length" class="chat-empty">暂无消息，发送第一条消息开始对话吧</div>
            <div v-for="msg in messages" :key="msg.id" :class="['chat-msg', msg.sender === 'user' ? 'chat-msg-right' : 'chat-msg-left']">
              <div class="chat-avatar" :class="msg.sender === 'admin' ? 'avatar-admin' : 'avatar-user'">
                {{ msg.sender === 'admin' ? '客' : (userInitial || '我') }}
              </div>
              <div class="chat-bubble-wrap">
                <div :class="['chat-bubble', msg.sender === 'admin' ? 'bubble-admin' : 'bubble-user']">{{ msg.content }}</div>
                <div class="chat-time">{{ formatTime(msg.createdAt) }}</div>
              </div>
            </div>
          </template>
        </div>

        <div class="chat-footer">
          <div class="chat-input-wrap">
            <input
              v-model="inputText"
              class="chat-input"
              placeholder="输入消息..."
              @keydown.enter="sendMessage"
              :disabled="sending || !isLoggedIn"
            />
            <button class="chat-send-btn" @click="sendMessage" :disabled="sending || !inputText.trim() || !isLoggedIn">
              <van-icon name="guide-o" size="20" :color="inputText.trim() ? '#fff' : 'rgba(255,255,255,0.5)'" />
            </button>
          </div>
          <div v-if="!isLoggedIn" class="chat-login-hint" @click="goLogin">请先登录后发送消息</div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { messageApi } from '@/api';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const userStore = useUserStore();
const showChat = ref(false);
const messages = ref([]);
const inputText = ref('');
const loading = ref(false);
const sending = ref(false);
const unreadCount = ref(0);
const chatBody = ref(null);

const isLoggedIn = computed(() => !!userStore.token);
const userInitial = computed(() => {
  const n = userStore.userInfo?.nickname || userStore.userInfo?.username || '';
  return n ? n[0] : '我';
});

let pollTimer = null;

const formatTime = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return isToday ? time : `${d.getMonth()+1}/${d.getDate()} ${time}`;
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight;
};

const loadMessages = async () => {
  if (!isLoggedIn.value) return;
  try {
    const res = await messageApi.mine();
    messages.value = res.data || [];
    unreadCount.value = 0;
    scrollToBottom();
  } catch { /* ignore */ }
};

const checkUnread = async () => {
  if (!isLoggedIn.value) return;
  try {
    const res = await messageApi.unread();
    unreadCount.value = res.data || 0;
  } catch { /* ignore */ }
};

const sendMessage = async () => {
  const content = inputText.value.trim();
  if (!content || sending.value || !isLoggedIn.value) return;
  sending.value = true;
  try {
    const res = await messageApi.send({ content });
    if (res.code === 0) {
      inputText.value = '';
      messages.value.push(res.data);
      scrollToBottom();
    } else {
      showToast(res.message || '发送失败');
    }
  } catch {
    showToast('发送失败');
  }
  sending.value = false;
};

let pendingAutoMsg = '';

const onOpen = async () => {
  await loadMessages();
  if (pendingAutoMsg && isLoggedIn.value) {
    inputText.value = pendingAutoMsg;
    pendingAutoMsg = '';
    await nextTick();
    await sendMessage();
  }
};

const toggleChat = () => {
  showChat.value = !showChat.value;
};

const openWithAutoMessage = (msg) => {
  pendingAutoMsg = msg || '';
  showChat.value = true;
};

defineExpose({ openWithAutoMessage });

const goLogin = () => {
  showChat.value = false;
  router.push('/login');
};

onMounted(() => {
  checkUnread();
  pollTimer = setInterval(checkUnread, 30000);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.chat-fab {
  position: fixed;
  bottom: 80px;
  right: 16px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #B91C1C, #991B1B);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(185, 28, 28, 0.4);
  cursor: pointer;
  z-index: 99;
  transition: transform 0.2s;
}
.chat-fab:active { transform: scale(0.92); }

.chat-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  background: #EF4444;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  text-align: center;
  line-height: 18px;
  padding: 0 4px;
  border: 2px solid #fff;
}

.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}
.chat-title { font-size: 16px; font-weight: 600; color: #1a1a1a; }
.chat-close { cursor: pointer; }

.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f8f8f8;
}

.chat-empty {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 60px 20px;
}

.chat-msg {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: flex-start;
}
.chat-msg-right { flex-direction: row-reverse; }

.chat-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
.avatar-admin { background: #B91C1C; color: #fff; }
.avatar-user { background: #E5E7EB; color: #6B7280; }

.chat-bubble-wrap { max-width: 75%; }
.chat-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}
.bubble-admin {
  background: #fff;
  color: #333;
  border: 1px solid #eee;
  border-top-left-radius: 4px;
}
.bubble-user {
  background: #B91C1C;
  color: #fff;
  border-top-right-radius: 4px;
}
.chat-time {
  font-size: 11px;
  color: #bbb;
  margin-top: 4px;
}
.chat-msg-right .chat-time { text-align: right; }

.chat-footer { padding: 12px 16px; border-top: 1px solid #f0f0f0; background: #fff; }
.chat-input-wrap { display: flex; gap: 8px; }
.chat-input {
  flex: 1;
  border: 1px solid #e5e5e5;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.chat-input:focus { border-color: #B91C1C; }
.chat-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #B91C1C;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.2s;
}
.chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.chat-login-hint {
  text-align: center;
  font-size: 13px;
  color: #B91C1C;
  margin-top: 8px;
  cursor: pointer;
  text-decoration: underline;
}
</style>
