import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/navigation/Sidebar";
import { MobileTopBar, MobileBottomBar } from "../components/navigation/MobileNav";
import SearchPanel from "../components/navigation/SearchPanel";
import CreatePostModal from "../components/modals/CreatePostModal";
import CreateStoryModal from "../components/modals/CreateStoryModal";
import PostDetailModal from "../components/modals/PostDetailModal";
import { MoreOptionsModal, ShareDialogModal } from "../components/modals/MoreAndShareModals";
import StoryViewerModal from "../components/stories/StoryViewerModal";
import EditProfileModal from "../components/modals/EditProfileModal";
import { useApp } from "../context/AppContext";

export default function MainLayout() {
  const location = useLocation();
  const { toastMessage, isSidebarCollapsed, isSearchOpen } = useApp();
  const effectiveCollapsed = isSidebarCollapsed || isSearchOpen;
  const isReelsPage = location.pathname === "/reels";
  const isMessagesPage = location.pathname === "/messages";

  return (
    <div className={`app-layout ${effectiveCollapsed ? "sidebar-collapsed" : ""} ${isReelsPage ? "reels-active" : ""} ${isMessagesPage ? "messages-active" : ""}`}>
      {/* Desktop / Tablet Sidebar */}
      <Sidebar />

      {/* Flyout Search Panel (Instagram style) */}
      <SearchPanel isInline={false} />

      {/* Mobile Top Navigation (hidden on reels and messages for custom/immersive view) */}
      {!isReelsPage && !isMessagesPage && <MobileTopBar />}

      {/* Main Content Viewport */}
      <main className={`main-content ${effectiveCollapsed ? "sidebar-collapsed" : ""} ${isReelsPage ? "reels-main-content" : ""} ${isMessagesPage ? "messages-main-content" : ""}`}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomBar />

      {/* Modals & Overlays */}
      <CreatePostModal />
      <CreateStoryModal />
      <PostDetailModal />
      <MoreOptionsModal />
      <ShareDialogModal />
      <StoryViewerModal />
      <EditProfileModal />

      {/* Toast Feedback */}
      {toastMessage && <div className="global-toast">{toastMessage}</div>}
    </div>
  );
}
