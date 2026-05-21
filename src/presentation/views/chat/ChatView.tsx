import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

/**
 * Chat layout shell — mirrors the SettingsLayout pattern.
 *
 * Owns the collapsible {@link Sidebar} on the left and an Outlet on
 * the right where sub-views render:
 *   /chat      → ConversationsView (index)
 *   /chat/:id  → individual chat session (future)
 */
export default function ChatView() {
  return (
    <div className="h-screen flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col" aria-label="Chat canvas">
        <Outlet />
      </div>
    </div>
  );
}
