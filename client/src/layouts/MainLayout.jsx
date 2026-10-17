import React from "react";
import { Outlet } from "react-router-dom";
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
  const { toastMessage, isSidebarCollapsed, isSearchOpen } = useApp();
  const effectiveCollapsed = isSidebarCollapsed || isSearchOpen;

  return (
    <div className={`app-layout ${effectiveCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Desktop / Tablet Sidebar */}
      <Sidebar />

      {/* Flyout Search Panel (Instagram style) */}
      <SearchPanel isInline={false} />

      {/* Mobile Top Navigation */}
      <MobileTopBar />

      {/* Main Content Viewport */}
      <main className={`main-content ${effectiveCollapsed ? "sidebar-collapsed" : ""}`}>
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
