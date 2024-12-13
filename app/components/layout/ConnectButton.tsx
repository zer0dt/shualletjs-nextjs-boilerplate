'use client'
import React, { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, LogOut, Download, Send } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {QRCodeSVG} from 'qrcode.react';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useToast } from "@/hooks/use-toast"

// Add this type for the different sheet views
type SheetView = 'main' | 'send' | 'backup' | 'disconnect' | 'import'

export default function ConnectButton() {
  const [isWalletInitialized, setIsWalletInitialized] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [walletBalance, setWalletBalance] = useState<string>('0')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bsvPrice, setBsvPrice] = useState<number>(0)
  const [sendAmount, setSendAmount] = useState('')
  const [sendAddress, setSendAddress] = useState('')
  const [backupFileName, setBackupFileName] = useState('')
  const [currentView, setCurrentView] = useState<SheetView>('main')

  const { toast } = useToast()

   // Add this new function
   const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        description: "Address copied to clipboard",
        duration: 1500
      })
    } catch (err) {
      console.error('Failed to copy:', err)
      toast({
        variant: "destructive",
        description: "Failed to copy address",
        duration: 1500
      })
    }
  }

  // Format balance to K format (e.g., 900K, 1.2M)
  const formatBalance = (balance: number): string => {
    return balance.toLocaleString('en-US')
  }

  useEffect(() => {
    // Check if wallet is initialized and fetch balance
    if (typeof window !== 'undefined' && window.localStorage.walletAddress) {
      setIsWalletInitialized(true)
      setWalletAddress(window.localStorage.walletAddress)
      fetchBalance()
    }
    fetchBSVPrice()
  }, [])

  const fetchBalance = async () => {
    if (typeof window !== 'undefined') {
      setIsLoading(true)
      try {
        const balanceInSatoshis = await getWalletBalance()
        console.log(window.localStorage.walletAddress)
        console.log(balanceInSatoshis)
        setWalletBalance(formatBalance(Number(balanceInSatoshis)))
      } catch (error) {
        console.error('Error fetching balance:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleClick = async () => {
    setIsLoading(true)
    try {
      if (!isWalletInitialized) {
        await setupWallet()
      } else {
        await fetchBalance() // Refresh balance before showing modal
        setIsModalOpen(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        if (json.ordPk && json.payPk) {
          // Clear UTXO cache before restoring new wallet
          clearUTXOs()
          
          restoreWallet(json.ordPk, json.payPk)
          setIsWalletInitialized(true)
          setWalletAddress(window.localStorage.walletAddress)
          fetchBalance()
          setIsModalOpen(true)
          setCurrentView('main')
          toast({
            description: "Wallet imported successfully",
            duration: 1500
          })
        } else {
          throw new Error('Invalid wallet file format')
        }
      } catch (e) {
        console.error(e)
        toast({
          variant: "destructive",
          description: "Error importing wallet: Invalid format",
          duration: 1500
        })
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const setupWallet = async () => {
    if (!window.localStorage.walletKey) {
      setIsModalOpen(true)
      setCurrentView('import')
    }
  }

  const handleLogout = () => {
    // Clear wallet data from localStorage
    localStorage.removeItem('walletKey')
    localStorage.removeItem('walletAddress')
    localStorage.removeItem('ownerKey')
    localStorage.removeItem('ownerAddress')
    localStorage.removeItem('ownerPublicKey')

    // Clear UTXO cache
    clearUTXOs()

    // Reset state
    setIsWalletInitialized(false)
    setWalletAddress('')
    setWalletBalance('0')
    setIsModalOpen(false)
    setCurrentView('main')

    // Show confirmation toast
    toast({
      description: "Wallet disconnected",
      duration: 1500
    })
  }

  const handleBackup = () => {
    if (!backupFileName.trim()) {
      toast({
        variant: "destructive",
        description: "Please enter a filename",
        duration: 1500
      })
      return
    }

    // Get the correct wallet data from localStorage
    const walletData = {
      ordPk: localStorage.ownerKey,
      payPk: localStorage.walletKey,
    }

    const dataStr = JSON.stringify(walletData)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    // Add .json extension if not present
    const filename = backupFileName.toLowerCase().endsWith('.json') 
      ? backupFileName 
      : `${backupFileName}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', filename)
    linkElement.click()
    
    setBackupFileName('')
    setCurrentView('main')
    
    toast({
      description: "Wallet backup created successfully",
      duration: 1500
    })
  }

  const handleSend = async () => {
    try {
      if (!sendAddress || !sendAmount) {
        toast({
          variant: "destructive",
          description: "Please enter both address and amount",
          duration: 1000
        })
        return
      }

      setIsLoading(true)
      const txid = await sendBSV(Number(sendAmount), sendAddress)
      if (txid) {
        setSendAmount('')
        setSendAddress('')
        setCurrentView('main')
        await fetchBalance()
        toast({
          description: "Transaction sent successfully",
          duration: 1500
        })
      }
    } catch (error) {
      console.error('Send error:', error)
      toast({
        variant: "destructive",
        description: error?.toString() || "Failed to send transaction",
        duration: 1500
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchBSVPrice = async () => {
    try {
      const response = await fetch('https://api.whatsonchain.com/v1/bsv/main/exchangerate')
      const data = await response.json()
      console.log('BSV Price data:', data)
      setBsvPrice(Number(data.rate))
    } catch (error) {
      console.error('Error fetching BSV price:', error)
    }
  }

  const calculateUSDValue = (sats: number): string => {
    const satoshis = Number(sats)
    if (isNaN(satoshis)) {
      return '0.0000'
    }
    
    const bsv = satoshis / 100000000
    
    const usd = bsv * bsvPrice
    
    if (isNaN(usd)) {
      return '0.0000'
    }
    
    return usd.toLocaleString('en-US', { 
      minimumFractionDigits: 4,
      maximumFractionDigits: 4 
    })
  }

  // Helper function to reset view when sheet closes
  const handleSheetOpenChange = (open: boolean) => {
    setIsModalOpen(open)
    if (!open) {
      // Reset to main view when sheet closes
      setTimeout(() => setCurrentView('main'), 150)
      // Reset other states
      setSendAmount('')
      setSendAddress('')
      setBackupFileName('')
    }
  }

  // Render different content based on current view
  const renderSheetContent = () => {
    switch (currentView) {
      case 'send':
        return (
          <>
            <SheetHeader>
              <SheetTitle>Send BSV</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="address">Recipient Address</Label>
                <Input
                  id="address"
                  value={sendAddress}
                  onChange={(e) => setSendAddress(e.target.value)}
                  placeholder="Enter BSV address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (in satoshis)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="Enter amount in sats"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentView('main')}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button 
                  onClick={handleSend}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      
                    </>
                  ) : (
                    'Send'
                  )}
                </Button>
              </div>
            </div>
          </>
        )

      case 'backup':
        return (
          <>
            <SheetHeader>
              <SheetTitle>Backup Wallet</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="filename">Backup Filename</Label>
                <Input
                  id="filename"
                  value={backupFileName}
                  onChange={(e) => setBackupFileName(e.target.value)}
                  placeholder="Enter filename (e.g., my-wallet-backup)"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setCurrentView('main')}>
                  Back
                </Button>
                <Button onClick={handleBackup}>Download Backup</Button>
              </div>
            </div>
          </>
        )

      case 'disconnect':
        return (
          <>
            <SheetHeader>
              <SheetTitle>Disconnect Wallet</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <p>Please make sure you have a backup of your wallet before disconnecting.</p>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setCurrentView('main')}>
                  Back
                </Button>
                <Button variant="destructive" onClick={handleLogout}>
                  Disconnect
                </Button>
              </div>
            </div>
          </>
        )

      case 'import':
        return (
          <>
            <SheetHeader>
              <SheetTitle>Setup Wallet</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <p>Would you like to import an existing wallet or create a new one?</p>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  fileInputRef.current?.click()
                  setIsModalOpen(false)
                }}>
                  Import Existing
                </Button>
                <Button onClick={async () => {
                  const paymentPk = newPK()
                  const ownerPK = newPK()
                  if (paymentPk && ownerPK) {
                    clearUTXOs()
                    restoreWallet(ownerPK, paymentPk, true)
                    setIsWalletInitialized(true)
                    setWalletAddress(window.localStorage.walletAddress)
                    await fetchBalance()
                    setCurrentView('backup')
                    toast({
                      description: "New wallet created. Please backup your wallet.",
                      duration: 1500
                    })
                  }
                }}>
                  Create New
                </Button>
              </div>
            </div>
          </>
        )

      default:
        return (
          <>
            <SheetHeader>
              <SheetTitle>Wallet</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col items-center space-y-4 p-4 mt-4">
              <QRCodeSVG value={walletAddress} size={200} />
              <div className="text-center space-y-2">
                <p 
                  className="font-mono text-sm break-all cursor-pointer hover:opacity-80"
                  onClick={() => copyToClipboard(walletAddress)}
                  title="Click to copy address"
                >
                  {walletAddress}
                </p>
                <p className="text-lg font-semibold">
                  {formatBalance(walletBalance)} sats - ${calculateUSDValue(Number(walletBalance.replace(/,/g, '')))}
                </p>
              </div>
              <div className="flex space-x-2 mt-4">
                <Button variant="outline" onClick={() => setCurrentView('send')}>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
                <Button variant="outline" onClick={() => setCurrentView('backup')}>
                  <Download className="w-4 h-4 mr-2" />
                  Backup
                </Button>
                <Button variant="outline" onClick={() => setCurrentView('disconnect')}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          </>
        )
    }
  }

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json"
        style={{ display: 'none' }}
      />
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleClick}
        className="h-10"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : walletAddress ? (
          <span className="text-xs">
            {`${walletBalance} sats`}
          </span>
        ) : (
          'Wallet'
        )}
      </Button>

      <Sheet open={isModalOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="bottom" className="w-full md:w-1/3 mx-auto rounded-t-[10px]">
          {renderSheetContent()}
        </SheetContent>
      </Sheet>
    </>
  )
}