import { UserButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

const Header = () => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="rounded-lg flex items-center gap-2">
          <img
            src="/glossy-blue-play-icon.png"
            className="size-11 rounded-lg object-cover shadow-[0_0_12px_rgba(56,189,248,0.45)]"
            alt="MelodyPlay"
          />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">MelodyPlay Admin</h1>
          <p className="text-zinc-400 mt-1">Manage your music catalog</p>
        </div>
      </div>
      <UserButton />
    </div>
  );
};
export default Header;
