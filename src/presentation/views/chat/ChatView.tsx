import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Sidebar } from './Sidebar';

// Lazy-loaded — only fetched when the user clicks "Chats" from the
// sidebar, since the typical user spends most of their time on the
// landing or inside a specific conversation.
const ChatsBrowserView = lazy(() => import('./ChatsBrowserView'));

/**
 * Chat layout shell.
 *
 * Owns the {@link Sidebar} on the left and the active view on the
 * right. The right pane usually renders the nested route's element
 * (``Outlet`` — landing or a specific conversation), with one
 * exception: when ``browseMode`` is on, it renders the chats browser
 * instead. ``browseMode`` is purely local UI state — toggled by the
 * sidebar's "Chats" menu item — and is reset whenever the user
 * navigates to any path other than the exact ``/chat`` landing.
 */
export default function ChatView() {
  const [browseMode, setBrowseMode] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Any route change away from the exact /chat path takes us out of
  // browse mode. Covers opening a specific chat (/chat/:id), starting
  // a new one, or leaving the chat surface entirely.
  useEffect(() => {
    if (location.pathname !== ROUTES.CHAT) {
      setBrowseMode(false);
    }
  }, [location.pathname]);

  const handleShowBrowser = useCallback(() => {
    if (location.pathname !== ROUTES.CHAT) {
      navigate(ROUTES.CHAT);
    }
    setBrowseMode(true);
  }, [location.pathname, navigate]);

  const handleNewChat = useCallback(() => {
    setBrowseMode(false);
    navigate(ROUTES.CHAT);
  }, [navigate]);

  return (
    <div className="h-screen flex">
      <Sidebar
        browseMode={browseMode}
        onShowBrowser={handleShowBrowser}
        onNewChat={handleNewChat}
      />
      <div className="flex-1 min-w-0 flex flex-col" aria-label="Chat canvas">
        {browseMode ? (
          <Suspense fallback={null}>
            <ChatsBrowserView />
          </Suspense>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
