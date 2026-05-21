import { ChatSidebar } from './ChatSidebar';

/**
 * Chat page — clean slate.
 *
 * Composed of the collapsible {@link ChatSidebar} on the left and an
 * empty canvas on the right. Add features into the canvas one at a
 * time (composer, message stream, header bar, etc.); this file should
 * stay the layout shell.
 */
export default function ChatView() {
  return (
    <div className="h-screen flex">
      <ChatSidebar />
      <div
        className="flex-1 min-w-0 flex flex-col"
        aria-label="Chat canvas"
      >
        {/* Intentionally empty — features get added here incrementally. */}
      </div>
    </div>
  );
}
