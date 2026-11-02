import React from 'react';
import { Home, Search, Library, SlidersHorizontal } from 'lucide-react';
import { ActiveTab } from '../types/music';

interface MobileNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenEqualizer: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenEqualizer,
}) => {
  return (
    <nav className="md:hidden w-full bg-[#070809]/95 backdrop-blur-md border-t border-white/[0.06] flex items-center justify-around py-2 px-3 z-30 select-none">
      <button
        onClick={() => onSelectTab('discover')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
          activeTab === 'discover' ? 'text-[#10B981]' : 'text-[#9A9FA3]'
        }`}
      >
        <Home className="size-5" />
        <span className="text-[10px] font-medium">Home</span>
      </button>

      <button
        onClick={() => onSelectTab('search')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
          activeTab === 'search' ? 'text-[#10B981]' : 'text-[#9A9FA3]'
        }`}
      >
        <Search className="size-5" />
        <span className="text-[10px] font-medium">Search</span>
      </button>

      <button
        onClick={() => onSelectTab('liked')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
          activeTab === 'liked' || activeTab === 'downloads' || activeTab === 'history'
            ? 'text-[#10B981]'
            : 'text-[#9A9FA3]'
        }`}
      >
        <Library className="size-5" />
        <span className="text-[10px] font-medium">Library</span>
      </button>

      <button
        onClick={onOpenEqualizer}
        className="flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[#9A9FA3] hover:text-[#F5F5F5] transition-colors cursor-pointer"
      >
        <SlidersHorizontal className="size-5" />
        <span className="text-[10px] font-medium">Studio EQ</span>
      </button>
    </nav>
  );
};
