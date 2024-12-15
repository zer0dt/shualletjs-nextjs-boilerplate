'use client'

import React, { useState } from "react"
import { Home, Menu, X } from "lucide-react"
import ConnectButton from "@/app/components/layout/ConnectButton"
import Link from 'next/link';
import { ModeToggle } from "@/components/ui/mode-toggle"
import { Button } from "@/components/ui/button"

const SharedLayout = ({ children }: { children: React.ReactNode }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen max-w-6xl mx-auto">
      <header className="flex items-center justify-between p-4 border-b bg-background">
        <Link href="/" legacyBehavior passHref>
          <a className="text-2xl font-bold text-primary yeezy-font">shuawalletjs</a> 
        </Link>
        <nav className="flex items-center space-x-4 lg:space-x-0">
          <ConnectButton />
          <ModeToggle />
          <button
            className="lg:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>
      </header>
      <main className="flex-1 flex">
        {/* Sidebar for Large Screens */}
        <aside className="hidden lg:block lg:w-1/4 p-4 border-r">
          <nav className="space-y-2">
            <Link href="/" passHref>
              <Button variant="ghost" className="w-full justify-start text-lg py-8 product-font">
                <Home className="w-7 h-7 mr-2" />Home
              </Button>
            </Link>
          </nav>
        </aside>
        {/* Mobile Menu */}
        {menuOpen && (
          <div className="absolute top-0 left-0 w-full h-screen bg-background z-50 flex flex-col items-center space-y-4 p-4 lg:hidden">
            <nav className="space-y-2">
              <Link href="/" passHref>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-lg py-8 product-font"
                  onClick={() => setMenuOpen(false)}
                >
                  <Home className="w-7 h-7 mr-2" />Home
                </Button>
              </Link>
            </nav>
          </div>
        )}
        <div className="w-full lg:w-1/2 overflow-y-auto">
          {children}
        </div>
        <aside className="hidden xl:block xl:w-1/4 p-4 border-l" />
      </main>
    </div>
  );
};

export default SharedLayout;
