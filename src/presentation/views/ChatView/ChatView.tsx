import { CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { APP_NAME } from '@/constants/api';

const CHAT_INSTRUCTIONS = `You are ${APP_NAME}, an intelligent AI assistant that helps users accomplish tasks using configurable multi-agent workflows. You have access to skills the user has configured. When users type /skill-name, invoke the appropriate skill. Be helpful, concise, and clear.`;

export default function ChatView() {
  return (
    <div className="h-screen flex flex-col">
      <CopilotChat
        className="flex-1"
        instructions={CHAT_INSTRUCTIONS}
        labels={{
          title: APP_NAME,
          placeholder: `Ask ${APP_NAME} anything, or type /skill-name…`,
          stopGenerating: 'Stop',
          regenerateResponse: 'Regenerate',
        }}
      />
    </div>
  );
}
