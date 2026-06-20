import ChatRoom from '@/features/communication/ChatRoom';
import { GLOBAL_CHAT_ID } from '@/shared/chat/useChat';

export default function GlobalChatPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
        Глобальный чат
      </h1>
      <ChatRoom chatId={GLOBAL_CHAT_ID} />
    </div>
  );
}
