'use client'

import React from "react"

import { Home } from "lucide-react"
import ConnectButton from "@/app/components/layout/ConnectButton"
import Link from 'next/link';
import { motion, AnimatePresence } from "framer-motion";
import { ModeToggle } from "@/components/ui/mode-toggle"
import { Button } from "@/components/ui/button"

const SharedLayout = ({ children }: { children: React.ReactNode }) => {

  return (
    <div className="flex flex-col min-h-screen max-w-6xl mx-auto">
      <header className="flex items-center justify-between p-4 border-b bg-background">
        <Link href="/" legacyBehavior passHref>
          <a className="text-2xl font-bold text-primary yeezy-font">shuawalletjs</a> 
        </Link>
        <nav className="flex items-center space-x-4">
          <ConnectButton />
          <ModeToggle />
        </nav>
      </header>
      <main className="flex-1 flex">
        <aside className="hidden lg:block lg:w-1/4 p-4 border-r">
          <nav className="space-y-2">
            <Link href="/" passHref>
              <Button variant="ghost" className="w-full justify-start text-lg py-8 product-font">
                <Home className="w-7 h-7 mr-2" />Home
              </Button>
            </Link>
          </nav>
        </aside>
        <div className="w-full lg:w-1/2 overflow-y-auto">
          {children}
        </div>
        <aside className="hidden xl:block xl:w-1/4 p-4 border-l" />
      </main>
    </div>
  );
};

export default SharedLayout;
