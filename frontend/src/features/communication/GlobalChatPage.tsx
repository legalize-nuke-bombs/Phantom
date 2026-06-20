import ChatRoom from '@/features/communication/ChatRoom';
import { GLOBAL_CHAT_ID } from '@/shared/chat/useChat';

export default function GlobalChatPage() {
  return (
    <div className="flex h-full flex-col gap-3">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
        Глобальный чат
      </h1>
      <div className="min-h-0 flex-1">
        <ChatRoom chatId={GLOBAL_CHAT_ID} />
      </div>
    </div>
  );
}
