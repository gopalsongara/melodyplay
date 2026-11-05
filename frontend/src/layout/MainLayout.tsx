import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Outlet } from "react-router-dom";
import LeftSidebar from "./components/LeftSidebar";
import FriendsActivity from "./components/FriendsActivity";
import AudioPlayer from "@/components/AudioPlayer";
import PlaybackControls from "./components/PlaybackControls";
import TopBar from "@/components/TopBar";
import MobileNav from "@/components/MobileNav";
import MobileNowPlaying from "@/components/MobileNowPlaying";
import { useIsMobile } from "@/hooks/useIsMobile";

const MainLayout = () => {
  const isMobile = useIsMobile();

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <AudioPlayer />
      <MobileNowPlaying />

      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden px-1.5 pt-1.5 pb-0 gap-1.5 w-full max-w-[100vw]">
          <TopBar />
          <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden rounded-lg overscroll-contain pb-1">
            <Outlet />
          </div>
        </div>
      ) : (
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 flex h-full overflow-hidden p-2"
        >
          <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
            <LeftSidebar />
          </ResizablePanel>

          <ResizableHandle className="w-2 bg-black rounded-lg transition-colors" />

          <ResizablePanel defaultSize={57} className="flex flex-col min-h-0 min-w-0">
            <TopBar />
            <div className="flex-1 min-h-0 overflow-hidden">
              <Outlet />
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-2 bg-black rounded-lg transition-colors" />

          <ResizablePanel
            defaultSize={25}
            minSize={0}
            maxSize={30}
            collapsedSize={0}
          >
            <FriendsActivity />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      <PlaybackControls />
      <MobileNav />
    </div>
  );
};

export default MainLayout;
