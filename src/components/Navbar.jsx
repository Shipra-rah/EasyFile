import { FileImage, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isHome = location.pathname === "/";

  const navItems = [
    {
      label: "Home",
      href: "/",
      type: "route",
    },
    {
      label: "PDF Tools",
      href: "/#pdf-tools",
      type: "anchor",
    },
    {
      label: "Image Tools",
      href: "/#image-tools",
      type: "anchor",
    },
    {
      label: "Convert",
      href: "/#tools",
      type: "anchor",
    },
  ];

  function closeMenu() {
    setOpen(false);
  }

  function handleAnchorClick() {
    closeMenu();

    // On the home page, let the browser scroll normally.
    // On another page, React Router navigates back to home first.
  }

  // Close mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Prevent background scrolling while mobile menu is open.
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const renderNavLink = (item, mobile = false) => {
    const active =
      item.type === "route" &&
      item.href === "/" &&
      isHome;

    const commonClass = `
      group relative flex items-center
      text-sm font-semibold
      transition-colors duration-200
      ${
        mobile
          ? "w-full rounded-xl px-4 py-3"
          : "px-1 py-2"
      }
      ${
        active
          ? "text-emerald-700"
          : "text-slate-600 hover:text-slate-950"
      }
    `;

    if (item.type === "route") {
      return (
        <Link
          key={item.label}
          to={item.href}
          onClick={closeMenu}
          className={commonClass}
        >
          {item.label}

          {!mobile && active && (
            <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-emerald-600" />
          )}
        </Link>
      );
    }

    return (
      <Link
        key={item.label}
        to={item.href}
        onClick={handleAnchorClick}
        className={commonClass}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] w-[92%] max-w-[1440px] items-center justify-between">
        {/* =====================================================
            LOGO
        ===================================================== */}
        <Link
          to="/"
          onClick={closeMenu}
          className="group flex items-center gap-3"
          aria-label="EasyFile home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm transition duration-200 group-hover:scale-[1.03] group-hover:bg-emerald-700">
            <FileImage size={20} strokeWidth={2.3} />
          </span>

          <span className="text-[21px] font-extrabold tracking-tight text-slate-950">
            Easy
            <span className="text-emerald-600">
              File
            </span>
          </span>
        </Link>

        {/* =====================================================
            DESKTOP NAVIGATION
        ===================================================== */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) =>
            renderNavLink(item),
          )}
        </nav>

        {/* =====================================================
            DESKTOP ACTIONS
        ===================================================== */}
        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            Login
          </button>

          <button
            type="button"
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md"
          >
            Sign Up
          </button>
        </div>

        {/* =====================================================
            MOBILE MENU BUTTON
        ===================================================== */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={
            open ? "Close menu" : "Open menu"
          }
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 lg:hidden"
        >
          {open ? (
            <X size={21} />
          ) : (
            <Menu size={21} />
          )}
        </button>
      </div>

      {/* =======================================================
          MOBILE MENU
      ======================================================= */}
      {open && (
        <div className="absolute left-0 right-0 top-[72px] border-b border-slate-200 bg-white shadow-lg lg:hidden">
          <div className="mx-auto w-[92%] max-w-[1440px] py-4">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) =>
                renderNavLink(item, true),
              )}

              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeMenu}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={closeMenu}
                  className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  Sign Up
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}