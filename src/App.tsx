/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Shield,
  Plus,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Send,
  Upload,
  User,
  Phone,
  DollarSign,
  AlertCircle,
  Check,
  ChevronRight,
  Info,
  Scale,
  RefreshCw,
  ExternalLink,
  Copy,
  ShieldCheck,
  HelpCircle,
  MessageSquare,
  FileText,
  Sun,
  Moon,
  Printer,
  Download
} from "lucide-react";
import { Transaction, EscrowStatus, EvidenceItem } from "./types";

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Theme state: dark = low-light high contrast, light = high-brightness sunlight mode
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("trustbridge-theme");
    return saved === "light" ? "light" : "dark";
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("trustbridge-theme", next);
    triggerToast(
      next === "light"
        ? "High-brightness Sunlight Theme active ☀️"
        : "Low-light High Contrast Dark Theme active 🌙"
    );
  };

  // New Transaction Form State
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [price, setPrice] = useState("");

  // Dispute Evidence Form State
  const [evidenceBy, setEvidenceBy] = useState<"buyer" | "seller">("buyer");
  const [evidenceText, setEvidenceText] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  // Interactive PDF Receipt & Escrow Agreement generation state
  const [showAgreementPDF, setShowAgreementPDF] = useState(false);

  // Interactive Live OPay Simulated Checkout Modal State
  const [showOPayModal, setShowOPayModal] = useState(false);
  const [opayStep, setOpayStep] = useState<"method" | "pin" | "processing" | "success">("method");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "transfer" | "card">("wallet");
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [opayLoadingText, setOpayLoadingText] = useState("");
  const [isInviteView, setIsInviteView] = useState(false);

  // Evidence file attachment simulation
  const [selectedAttachment, setSelectedAttachment] = useState<string>("");

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch all transactions from Express backend
  const fetchTransactions = async (selectIdAfterFetch?: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/transactions");
      if (!res.ok) throw new Error("Failed to pull transactions from database.");
      const data: Transaction[] = await res.json();
      setTransactions(data);

      // Preserve or set selected transaction
      if (selectIdAfterFetch) {
        const found = data.find((t) => t.id === selectIdAfterFetch);
        if (found) setSelectedTrx(found);
      } else if (selectedTrx) {
        const found = data.find((t) => t.id === selectedTrx.id);
        if (found) setSelectedTrx(found);
      } else if (data.length > 0 && !selectedTrx) {
        setSelectedTrx(data[0]);
      }
      setApiError(null);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Could not synchronize with the TrustBridge server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Read optional transaction ID from URL params (for shared escrow link simulation!)
    const urlParams = new URLSearchParams(window.location.search);
    const trxId = urlParams.get("trxId");
    if (trxId) {
      setIsInviteView(true);
    }
    fetchTransactions(trxId || undefined);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    triggerToast("WhatsApp escrow link copied to clipboard!");
  };

  // Create Escrow Transaction
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerName || !sellerPhone || !buyerName || !buyerPhone || !itemName || !price) {
      triggerToast("Please fill in all transaction fields.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerName,
          sellerPhone,
          buyerName,
          buyerPhone,
          itemName,
          itemDescription,
          price: Number(price),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to catalog escrow transaction.");
      }

      const newTrx: Transaction = await res.json();
      triggerToast(`Escrow ${newTrx.id} created & audited by Gemini!`);
      setShowCreateForm(false);
      
      // Reset form options
      setSellerName("");
      setSellerPhone("");
      setBuyerName("");
      setBuyerPhone("");
      setItemName("");
      setItemDescription("");
      setPrice("");

      // Refresh list and auto-select new transaction
      await fetchTransactions(newTrx.id);
    } catch (err: any) {
      triggerToast(err.message || "Could not register transaction.");
    } finally {
      setActionLoading(false);
    }
  };

  // Perform Standard Transition Actions
  const handleStatusAction = async (action: string, payload: any = {}) => {
    if (!selectedTrx) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/transactions/${selectedTrx.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "System transition rejected.");
      }

      const updated: Transaction = await res.json();
      setSelectedTrx(updated);
      triggerToast(`Transaction status updated to: ${updated.status}`);
      await fetchTransactions(updated.id);
    } catch (err: any) {
      triggerToast(err.message || "Action request failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Secure deposit with simulated OPay modal
  const handleSecureDepositClick = () => {
    if (selectedTrx) {
      setSelectedTrx(selectedTrx);
      setShowOPayModal(true);
      setOpayStep("method");
      setPinDigits([]);
    }
  };

  // Automated Holding Ingress process simulation
  const triggerOPayHoldingProcess = async () => {
    setOpayStep("processing");
    setOpayLoadingText("Initiating OPay secure vault tokenization...");
    
    setTimeout(() => {
      setOpayLoadingText("Analyzing scam flags via Gemini 1.5 compliance radar...");
    }, 1005);

    setTimeout(() => {
      setOpayLoadingText("Locking funds securely in TrustBridge smart escrow account...");
    }, 2010);

    setTimeout(async () => {
      try {
        await handleStatusAction("deposit");
        setOpayStep("success");
      } catch (err) {
        triggerToast("OPay Escrow deposit processing failed.");
        setOpayStep("pin");
        setPinDigits([]);
      }
    }, 3015);
  };

  // Submit Dispute Evidence
  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrx || !evidenceText.trim()) {
      triggerToast("Please provide an evidence argument.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/transactions/${selectedTrx.id}/dispute/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by: evidenceBy,
          text: evidenceText,
          imageUrl: selectedAttachment || undefined
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Could not attach evidence logs.");
      }

      const updated: Transaction = await res.json();
      setSelectedTrx(updated);
      setEvidenceText("");
      setSelectedAttachment(""); // reset preview
      triggerToast("Evidence processed. Gemini AI has updated its recommended split.");
      await fetchTransactions(updated.id);
    } catch (err: any) {
      triggerToast(err.message || "Dispute action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Prompt dispute modal
  const handleRaiseDispute = () => {
    if (!selectedTrx) return;
    setShowDisputeModal(true);
  };

  const submitDisputeNotice = async () => {
    if (!disputeReason.trim()) {
      triggerToast("Please outline your dispute reasons.");
      return;
    }
    setShowDisputeModal(false);
    await handleStatusAction("dispute", { raisedBy: "buyer", reason: disputeReason });
    setDisputeReason("");
  };

  // Inject Presets for fast Challenge Demonstration
  const loadPresetScenarios = (scenario: "low" | "high" | "dispute_evidence") => {
    if (scenario === "low") {
      setSellerName("Bisi Textiles Ogun");
      setSellerPhone("+2348039201928");
      setBuyerName("Adebayo Shola");
      setBuyerPhone("+2348123019201");
      setItemName("Premium Lace Aso-Ebi Materials (5 Yards)");
      setItemDescription("Original heavyweight luxury lace, verified color coordinates. Delivery to Abeokuta using local park shuttle transport. Pay and inspect code on transit arrival.");
      setPrice("45000");
      setShowCreateForm(true);
      triggerToast("Loaded Low-Risk preset. Tap 'Deploy Escrow Smart Link' to audit!");
    } else if (scenario === "high") {
      setSellerName("PromoStore Lagos DMs");
      setSellerPhone("+2349071239871");
      setBuyerName("Femi Johnson");
      setBuyerPhone("+2348052341122");
      setItemName("iPhone 15 Pro Max (Brand New sealed)");
      setItemDescription("PROMO RUNS TODAY ONLY! Box is sealed. Selling for cheap price because of urgent travel out of Nigeria. Buyer must deposit full sum immediately. No physical viewing until payment cleared due to customs office restrictions.");
      setPrice("130000");
      setShowCreateForm(true);
      triggerToast("Loaded High-Risk Ghost Seller preset. Click create and watch Gemini audit the Red Flags!");
    } else if (scenario === "dispute_evidence") {
      // Find historical Alaba PC dispute and set focus
      const disputeTrx = transactions.find((t) => t.id === "TB-40182");
      if (disputeTrx) {
        setSelectedTrx(disputeTrx);
        setShowCreateForm(false);
        triggerToast("Focused on active HP Laptop dispute! Try adding evidence on the right pane.");
      } else {
        triggerToast("Please reload the transaction database.");
      }
    }
  };

  // Color mappings for different stages (Optimized for Sunlight vs. low-light contrast)
  const getStatusBadgeClass = (status: EscrowStatus) => {
    if (theme === "dark") {
      switch (status) {
        case "AWAITING_DEPOSIT":
          return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        case "SECURED_IN_ESCROW":
          return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        case "DELIVERED_AWAITING_CONFIRMATION":
          return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
        case "RESOLVED_RELEASED":
          return "bg-slate-900 text-slate-400 border-slate-800 line-through opacity-75";
        case "RESOLVED_REFUNDED":
          return "bg-red-500/15 text-red-400 border-red-500/20 opacity-75";
        case "DISPUTED":
          return "bg-rose-500/15 text-rose-400 border-rose-400/30 animate-pulse";
      }
    } else {
      switch (status) {
        case "AWAITING_DEPOSIT":
          return "bg-amber-105 text-amber-950 border border-amber-450 font-bold";
        case "SECURED_IN_ESCROW":
          return "bg-emerald-100 text-emerald-950 border border-emerald-500 font-bold";
        case "DELIVERED_AWAITING_CONFIRMATION":
          return "bg-cyan-100 text-cyan-950 border border-cyan-400 font-bold";
        case "RESOLVED_RELEASED":
          return "bg-slate-100 text-slate-700 border border-slate-300 line-through font-bold opacity-85";
        case "RESOLVED_REFUNDED":
          return "bg-rose-100 text-rose-950 border border-rose-300 font-bold opacity-85";
        case "DISPUTED":
          return "bg-rose-150 text-rose-950 border-2 border-rose-500 font-black animate-pulse shadow-sm";
      }
    }
  };

  const getStatusTitle = (status: EscrowStatus) => {
    switch (status) {
      case "AWAITING_DEPOSIT":
        return "Awaiting Buyer Deposit";
      case "SECURED_IN_ESCROW":
        return "Funds Secured In Escrow";
      case "DELIVERED_AWAITING_CONFIRMATION":
        return "Dispatched & Awaiting Confirmation";
      case "RESOLVED_RELEASED":
        return "Resolved & Funds Released";
      case "RESOLVED_REFUNDED":
        return "Resolved & Funds Refunded";
      case "DISPUTED":
        return "Disputed (AI Arbitration Online)";
    }
  };

  return (
    <div className={`min-h-screen flex flex-col antialiased transition-colors duration-200 selection:bg-emerald-500 selection:text-slate-900 ${
      theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900 font-medium"
    }`} id="trustbridge-container">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 border-2 shadow-2xl rounded-xl px-5 py-4 flex items-center gap-3 animate-bounce ${
          theme === "dark" 
            ? "bg-slate-900 border-emerald-500 text-slate-100 shadow-emerald-500/10" 
            : "bg-white border-emerald-600 text-slate-950 shadow-xl"
        }`} id="toast-notif">
          <ShieldCheck className={`w-6 h-6 shrink-0 ${theme === "dark" ? "text-emerald-400" : "text-emerald-650"}`} />
          <span className="text-sm font-bold tracking-wide">{toastMessage}</span>
        </div>
      )}

      {/* Primary Navigation / OPay Challege Branding */}
      <header className={`border-b backdrop-blur-md sticky top-0 z-40 py-4 px-6 transition-colors duration-200 ${
        theme === "dark" 
          ? "border-slate-800/80 bg-slate-900/60" 
          : "border-slate-300 bg-white shadow-sm"
      }`} id="main-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 shadow-lg ${
              theme === "dark"
                ? "bg-emerald-500/10 border-emerald-500 shadow-emerald-500/10"
                : "bg-emerald-55/40 border-emerald-600 shadow-sm"
            }`}>
              <Shield className={`w-6 h-6 ${theme === "dark" ? "text-emerald-400" : "text-emerald-600"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold text-2xl tracking-tight transition-colors ${theme === "dark" ? "text-white" : "text-slate-950"}`}>
                  Trust<span className={theme === "dark" ? "text-emerald-400" : "text-emerald-650"}>Bridge</span>
                </span>
                <span className={`text-[10px] font-extrabold tracking-widest px-2 py-0.5 rounded border transition-colors ${
                  theme === "dark"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-emerald-50 text-emerald-805 border-emerald-400/50"
                }`}>AI ESCROW</span>
              </div>
              <p className={`text-xs transition-colors ${theme === "dark" ? "text-slate-400" : "text-slate-700 font-bold"}`}>
                OPay National Innovation Challenge 2026 — Fintech & Payments Domain
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
              theme === "dark"
                ? "bg-slate-800 border-slate-700/50 text-slate-400"
                : "bg-slate-100 border-slate-300 text-slate-800"
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${theme === "dark" ? "bg-emerald-400" : "bg-emerald-600"}`}></span>
              Ogun State Representative
            </span>
            <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
              theme === "dark"
                ? "bg-slate-800 border-slate-700/50 text-slate-400"
                : "bg-slate-100 border-slate-300 text-slate-800"
            }`}>
              Institution: <b className={theme === "dark" ? "text-emerald-400" : "text-emerald-800"}>Olabisi Onabanjo University</b>
            </span>
            <button 
              onClick={() => fetchTransactions()}
              className={`p-2 rounded-lg border transition ${
                theme === "dark"
                  ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-emerald-400"
                  : "bg-white border-slate-300 hover:bg-slate-100 text-emerald-705"
              }`}
              title="Refresh Transaction List"
              id="refresh-db-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition-all flex items-center gap-1.5 focus:outline-none cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-800 border-slate-700 hover:bg-slate-750 text-amber-400"
                  : "bg-amber-100 border-amber-300 hover:bg-amber-150 text-amber-800"
              }`}
              title={theme === "dark" ? "Switch to Sunlight Mode" : "Switch to Low-light Mode"}
              id="theme-toggler"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-bold tracking-wide">Sunlight Theme</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-amber-805 shrink-0" />
                  <span className="text-[11px] font-bold tracking-wide">Low-light Theme</span>
                </>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Demonstration / Interactive Jugu Guide */}
      <section className="bg-slate-900 border-b border-slate-850 py-3.5 px-6" id="judge-guide-section">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-bold text-emerald-400 flex items-center gap-1 mb-1">
              <Info className="w-3.5 h-3.5 shrink-0" /> OPAY CHALLENGE DEMO DECK — SIMULATE ESCROW TESTING SCENARIOS:
            </span>
            <span className="text-slate-400 block sm:inline">
              TrustBridge acts as an intermediary secure wallet to prevent Nigerian social media commercial fraud. 
            </span>
            <span className="text-slate-350 sm:ml-1 underline font-medium">
              Click any scenario to instantly seed preset parameters into the simulator stage!
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadPresetScenarios("low")}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-[11px] font-bold border border-emerald-500/20 text-emerald-300 transition-all flex items-center gap-1"
              id="preset-low-btn"
            >
              <CheckCircle className="w-3 h-3" /> Preset A: Low Fraud Risk
            </button>
            <button
              onClick={() => loadPresetScenarios("high")}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-[11px] font-bold border border-red-500/20 text-rose-300 transition-all flex items-center gap-1"
              id="preset-high-btn"
            >
              <AlertTriangle className="w-3 h-3" /> Preset B: High Risk scam
            </button>
            <button
              onClick={() => loadPresetScenarios("dispute_evidence")}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-[11px] font-bold border border-blue-500/20 text-cyan-300 transition-all flex items-center gap-1"
              id="preset-dispute-btn"
            >
              <Scale className="w-3 h-3" /> Preset C: Alaba Dispute Court
            </button>
          </div>
        </div>
      </section>

      {/* Main Hub Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-stage">

        {/* Global Connection / Cold start error retry panel */}
        {apiError && (
          <div className="col-span-12 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-450 flex items-center justify-between gap-3 shadow-md animate-fade-in" id="global-connection-error">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-550 animate-pulse" />
              <div className="text-left">
                <span className="font-extrabold block">Server Connection Sync Interrupted</span>
                <span className="text-slate-400">TrustBridge local database could not be reached: {apiError}</span>
              </div>
            </div>
            <button 
              onClick={() => fetchTransactions()}
              className="px-3.5 py-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-650 transition font-bold cursor-pointer"
            >
              Sync Database
            </button>
          </div>
        )}

        {/* Full-width Shared Link Invitation Greeting Card */}
        {isInviteView && selectedTrx && (
          <div className={`col-span-12 border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in ${
            theme === "dark" 
              ? "bg-slate-900/90 border-emerald-500/30 text-white shadow-lg" 
              : "bg-emerald-50 border-emerald-500/40 text-slate-900 shadow-sm"
          }`} id="shared-invite-banner">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme === "dark" ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-600 text-white"}`}>
                <ShieldCheck className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-left">
                <h3 className="font-extrabold text-sm md:text-base leading-snug">OPay Fast Escrow Invitation Secured!</h3>
                <p className={`text-xs ${theme === "dark" ? "text-slate-300" : "text-slate-700 font-semibold"}`}>
                  <b>{selectedTrx.sellerName}</b> created this contract in trust to sell <b>{selectedTrx.itemName}</b> for <b>₦{selectedTrx.price.toLocaleString()}</b>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              {selectedTrx.status === "AWAITING_DEPOSIT" ? (
                <button
                  onClick={handleSecureDepositClick}
                  className={`w-full md:w-auto px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer text-center ${
                    theme === "dark" ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-lg shadow-emerald-500/10" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                  }`}
                >
                  Pay secure holding NGN {selectedTrx.price.toLocaleString()}
                </button>
              ) : (
                <span className={`w-full md:w-auto px-4 py-2 text-xs font-extrabold rounded-xl border block text-center ${
                  selectedTrx.status === "SECURED_IN_ESCROW" ? "bg-emerald-500/10 text-emerald-400 border-emerald-550" : "bg-slate-800 text-slate-300 border-slate-700"
                }`}>
                  Safe Vault State: Active
                </span>
              )}
              <button
                onClick={() => setIsInviteView(false)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition shrink-0 ${theme === "dark" ? "hover:bg-slate-800 border-slate-700 text-slate-400 bg-slate-900" : "hover:bg-slate-100 border-slate-300 text-slate-705 bg-white"}`}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* LEFT COLUMN: Escrows Listing (Grid Span 4) */}
        <section className="lg:col-span-4 flex flex-col gap-4" id="listings-column">
          
          <div className={`rounded-2xl p-4 flex flex-col gap-3 border transition-colors duration-200 ${
            theme === "dark"
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-300 shadow-sm"
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold tracking-wide uppercase ${theme === "dark" ? "text-slate-300" : "text-slate-800"}`}>Registered Escrow Links</h3>
              <button 
                onClick={() => {
                  setShowCreateForm(true);
                  setSelectedTrx(null);
                }}
                className={`px-2.5 py-1 text-xs font-black rounded-lg flex items-center gap-1 transition shadow-md cursor-pointer ${
                  theme === "dark"
                    ? "text-slate-900 bg-emerald-400 hover:bg-emerald-300 shadow-emerald-400/5"
                    : "text-white bg-emerald-650 hover:bg-emerald-600"
                }`}
                id="initiate-escrow-btn"
              >
                <Plus className="w-3.5 h-3.5" /> New Escrow
              </button>
            </div>

            {loading && transactions.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
                <p className="text-xs text-slate-400">Loading escrow agreements...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 border-2 border-dashed border-slate-850 rounded-xl">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No escrows found on the server.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1" id="escrow-list-container">
                {transactions.map((trx) => {
                  const isSelected = selectedTrx?.id === trx.id && !showCreateForm;
                  return (
                    <div
                      key={trx.id}
                      onClick={() => {
                        setSelectedTrx(trx);
                        setShowCreateForm(false);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? theme === "dark"
                            ? "bg-slate-800 border-emerald-500 shadow-md shadow-emerald-500/5 scale-[1.01]"
                            : "bg-emerald-50/70 border-2 border-emerald-600 shadow-sm scale-[1.01]"
                          : theme === "dark"
                            ? "bg-slate-900/40 border-slate-850 hover:bg-slate-800/50 hover:border-slate-800"
                            : "bg-slate-50 border-slate-300 hover:bg-slate-100/60 hover:border-slate-400"
                      }`}
                      id={`escrow-item-${trx.id}`}
                    >
                      <div className="flex justify-between items-start gap-1 mb-1.5">
                        <span className={`text-xs font-extrabold font-mono tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-700"}`}>{trx.id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(trx.status)}`}>
                          {trx.status === "DISPUTED" ? "DISPUTE ACTIVE" : trx.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      
                      <h4 className={`text-xs font-bold line-clamp-1 mb-1 ${theme === "dark" ? "text-white" : "text-slate-950 font-extrabold"}`}>{trx.itemName}</h4>
                      
                      <div className="flex justify-between items-center text-[11px]">
                        <div className={`flex items-center gap-1 ${theme === "dark" ? "text-slate-400" : "text-slate-700 font-bold"}`}>
                          <User className={`w-3.5 h-3.5 ${theme === "dark" ? "text-emerald-400" : "text-emerald-700"}`} />
                          <span className="max-w-[80px] truncate">{trx.sellerName}</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                          <span className="max-w-[80px] truncate">{trx.buyerName}</span>
                        </div>
                        <span className={`text-xs font-black font-mono ${theme === "dark" ? "text-emerald-400" : "text-emerald-800"}`}>₦{trx.price.toLocaleString()}</span>
                      </div>

                      {/* Gemini audit brief marker */}
                      <div className={`mt-2 text-[10px] p-1.5 rounded-lg border flex items-center justify-between ${
                        theme === "dark" ? "bg-slate-955/50 border-slate-800" : "bg-slate-100 border-slate-300 text-slate-850 font-bold"
                      }`}>
                        <span className="font-semibold select-none">Gemini Risk Audited:</span>
                        <span className={`font-black tracking-wide ${
                          trx.fraudRisk.riskLevel === "High" ? (theme === "dark" ? "text-rose-450" : "text-rose-800") :
                          trx.fraudRisk.riskLevel === "Medium" ? (theme === "dark" ? "text-amber-450" : "text-amber-800") :
                          (theme === "dark" ? "text-emerald-400" : "text-emerald-850")
                        }`}>{trx.fraudRisk.score}% Risk</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Informational Platform Stats Widget */}
          <div className={`border rounded-2xl p-4 flex flex-col gap-2 text-xs transition-colors duration-200 ${
            theme === "dark"
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-300 text-slate-900 shadow-sm"
          }`} id="quick-stats-card">
            <h4 className={`font-bold border-b pb-1.5 ${theme === "dark" ? "text-slate-300 border-slate-800" : "text-slate-850 border-slate-200"}`}>Why OPay TrustBridge Escrow?</h4>
            <ul className={`space-y-1.5 leading-relaxed ${theme === "dark" ? "text-slate-400" : "text-slate-800 font-semibold"}`}>
              <li className="flex items-start gap-1.5">
                <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${theme === "dark" ? "text-emerald-400" : "text-emerald-700"}`} />
                <span><b>Zero upfront pocket-loss</b>: Funds held securely in escrow wallets.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className={`w-4 h-4 shrink-0 mt-0.5 ${theme === "dark" ? "text-emerald-400" : "text-emerald-700"}`} />
                <span><b>72hr Delivery window</b>: Prevents sellers from holding buyer money hostage.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${theme === "dark" ? "text-emerald-400" : "text-emerald-700"}`} />
                <span><b>AI Disputes</b>: Automated neutral evidence audit within hours.</span>
              </li>
            </ul>
          </div>

        </section>

        {/* RIGHT COLUMN: Interactive Stage (Grid Span 8) */}
        <section className="lg:col-span-8 flex flex-col gap-4" id="stage-column">
          
          {/* STATE A: Show Create Transaction Form */}
          {showCreateForm ? (
            <div className={`border rounded-2xl p-5 md:p-6 transition-all duration-200 ${
              theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-300 shadow-sm"
            }`} id="escrow-create-panel">
              
              <div className={`flex justify-between items-center border-b pb-4 mb-4 ${
                theme === "dark" ? "border-slate-800" : "border-slate-200"
              }`}>
                <div>
                  <h2 className={`text-lg font-extrabold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-950"}`}>
                    <Plus className={`w-5 h-5 animate-pulse ${theme === "dark" ? "text-emerald-400" : "text-emerald-700"}`} /> Register New Escrow Transaction
                  </h2>
                  <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-650"}`}>Specify buy/sell attributes. Gemini 1.5 Flash evaluates risk immediately.</p>
                </div>
                <button 
                  onClick={() => {
                    setShowCreateForm(false);
                    if (transactions.length > 0) setSelectedTrx(transactions[0]);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    theme === "dark"
                      ? "text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-900 border-slate-800"
                      : "text-slate-800 hover:bg-slate-100 bg-slate-50 border-slate-305"
                  }`}
                  id="cancel-create-btn"
                >
                  Back to List
                </button>
              </div>

              <form onSubmit={handleCreateTransaction} className="space-y-4" id="create-escrow-form">
                
                {/* Visual Section: Parties */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Seller Details */}
                  <div className={`border p-4 rounded-xl space-y-3 ${
                    theme === "dark" ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-250"
                  }`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                      theme === "dark" ? "text-emerald-400" : "text-emerald-800"
                    }`}>
                      <User className="w-3.5 h-3.5" /> Merchant / Seller Info
                    </h3>
                    <div>
                      <label className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                        theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"
                      }`}>Seller Name</label>
                      <input 
                        type="text" 
                        value={sellerName}
                        onChange={(e) => setSellerName(e.target.value)}
                        placeholder="e.g. StyleHub Lagos"
                        className={`w-full rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${
                          theme === "dark" ? "bg-slate-900 border border-slate-800 text-slate-100" : "bg-white border-2 border-slate-300 text-slate-950 font-bold placeholder:text-slate-400"
                        }`}
                        required
                        id="form-seller-name"
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                        theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"
                      }`}>OPay Phone Number / ID</label>
                      <div className="relative">
                        <Phone className={`absolute left-2.5 top-2.5 w-3.5 h-3.5 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`} />
                        <input 
                          type="tel" 
                          value={sellerPhone}
                          onChange={(e) => setSellerPhone(e.target.value)}
                          placeholder="e.g. +2348012345678"
                          className={`w-full rounded-lg pl-8 pr-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${
                            theme === "dark" ? "bg-slate-900 border border-slate-800 text-slate-100" : "bg-white border-2 border-slate-300 text-slate-950 font-bold placeholder:text-slate-400"
                          }`}
                          required
                          id="form-seller-phone"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Buyer Details */}
                  <div className={`border p-4 rounded-xl space-y-3 ${
                    theme === "dark" ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-250"
                  }`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                      theme === "dark" ? "text-emerald-400" : "text-emerald-800"
                    }`}>
                      <User className="w-3.5 h-3.5" /> Product Buyer Info
                    </h3>
                    <div>
                      <label className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                        theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"
                      }`}>Buyer Name</label>
                      <input 
                        type="text" 
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="e.g. Chioma Nnaji"
                        className={`w-full rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${
                          theme === "dark" ? "bg-slate-900 border border-slate-800 text-slate-100" : "bg-white border-2 border-slate-300 text-slate-950 font-bold placeholder:text-slate-400"
                        }`}
                        required
                        id="form-buyer-name"
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                        theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"
                      }`}>Buyer Phone Number (OPay Wallet)</label>
                      <div className="relative">
                        <Phone className={`absolute left-2.5 top-2.5 w-3.5 h-3.5 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`} />
                        <input 
                          type="tel" 
                          value={buyerPhone}
                          onChange={(e) => setBuyerPhone(e.target.value)}
                          placeholder="e.g. +2349023334444"
                          className={`w-full rounded-lg pl-8 pr-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${
                            theme === "dark" ? "bg-slate-900 border border-slate-800 text-slate-100" : "bg-white border-2 border-slate-300 text-slate-950 font-bold placeholder:text-slate-400"
                          }`}
                          required
                          id="form-buyer-phone"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deal Details */}
                <div className={`border p-4 rounded-xl space-y-3 ${
                  theme === "dark" ? "bg-slate-955/40 border-slate-850" : "bg-slate-50 border-slate-250"
                }`}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                    theme === "dark" ? "text-emerald-400" : "text-emerald-800"
                  }`}>
                    <FileText className="w-3.5 h-3.5" /> Merchandise & Pricing
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-8">
                      <label className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                        theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"
                      }`}>Item Title / Service description (e.g. iPhone 13 London used)</label>
                      <input 
                        type="text" 
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="e.g. Refurbished Hp Laptop or Lace materials"
                        className={`w-full rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${
                          theme === "dark" ? "bg-slate-900 border border-slate-800 text-slate-100" : "bg-white border-2 border-slate-300 text-slate-950 font-bold placeholder:text-slate-400"
                        }`}
                        required
                        id="form-item-name"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                        theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"
                      }`}>Negotiated Price (₦ NGN)</label>
                      <div className="relative">
                        <span className={`absolute left-2.5 top-2.5 text-xs font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>₦</span>
                        <input 
                          type="number" 
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="e.g. 50000"
                          className={`w-full rounded-lg pl-6 pr-3 py-2 text-xs font-extrabold focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono transition-colors ${
                            theme === "dark" ? "bg-slate-900 border border-slate-800 text-emerald-400" : "bg-white border-2 border-slate-300 text-emerald-850 font-bold"
                          }`}
                          required
                          id="form-price"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                      theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"
                    }`}>Detailed Terms & Shipping Inspection Agreement</label>
                    <textarea 
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      placeholder="Explain how the item will be delivered, color sizes, and criteria for confirmation (for example, physical test for 10 minutes at delivery terminal before confirmation)."
                      rows={3}
                      className={`w-full rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${
                        theme === "dark" ? "bg-slate-900 border border-slate-800 text-slate-100" : "bg-white border-2 border-slate-300 text-slate-950 font-semibold placeholder:text-slate-400"
                      }`}
                      required
                      id="form-description"
                    />
                  </div>
                </div>

                {/* Submitting Buttons */}
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`w-full py-3 text-xs uppercase tracking-widest font-extrabold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-lg ${
                    theme === "dark"
                      ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-emerald-400/10"
                      : "bg-emerald-650 text-white hover:bg-emerald-600 shadow-md animate-pulse-subtle"
                  }`}
                  id="submit-escrow-btn"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Performing Gemini AI Risk Audit...
                    </>
                  ) : (
                    <>
                      Generate OPay Escrow & Share Link <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </form>

            </div>
          ) : selectedTrx ? (
            /* STATE B: Show Selected Escrow Interaction & Checkout Screen */
            <div className="flex flex-col gap-4" id="escrow-details-workspace">
              
              {/* Left & Right Main Panel of details */}
              <div className={`transition-all duration-200 border rounded-2xl p-5 flex flex-col gap-5 ${
                theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-300 shadow-sm"
              }`}>
                
                {/* Header Metadata */}
                <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b pb-4 ${
                  theme === "dark" ? "border-slate-800" : "border-slate-200"
                }`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className={`text-lg font-extrabold font-mono ${theme === "dark" ? "text-white" : "text-slate-950"}`}>{selectedTrx.id}</h2>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold tracking-wide uppercase ${getStatusBadgeClass(selectedTrx.status)}`}>
                        {getStatusTitle(selectedTrx.status)}
                      </span>
                    </div>
                    <time className={`text-[10px] font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-600 font-bold"}`}>Registered on: {new Date(selectedTrx.createdAt).toLocaleString()}</time>
                  </div>

                  {/* Shareable payment link widget */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(selectedTrx.paymentLink)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1 transition ${
                        theme === "dark"
                          ? "bg-slate-800 hover:bg-slate-750 text-emerald-400 border-slate-750"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-805 border-emerald-200"
                      }`}
                      id="share-escrow-btn"
                    >
                      <Copy className="w-3.5 h-3.5" /> Share Escrow Links
                    </button>
                    
                    {/* Simulated External Link */}
                    <a
                      href={selectedTrx.paymentLink}
                      target="_blank"
                      rel="noreferrer"
                      className={`p-1.5 shrink-0 rounded-lg transition ${
                        theme === "dark"
                          ? "bg-slate-850 hover:bg-slate-805 text-slate-400"
                          : "bg-slate-100 hover:bg-slate-150 text-slate-700"
                      }`}
                      title="Open shared checkout view in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Interactive Transaction Tracker (OPay Steps) */}
                <div className={`border p-4 rounded-xl ${
                  theme === "dark" ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-250"
                }`} id="progress-meter">
                  <div className="grid grid-cols-4 gap-2 text-center relative">
                    
                    {/* Horizontal connector line */}
                    <div className={`absolute top-[18px] left-[12.5%] right-[12.5%] h-0.5 ${theme === "dark" ? "bg-slate-800" : "bg-slate-300"}`}>
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-550" 
                        style={{
                          width: 
                            selectedTrx.status === "AWAITING_DEPOSIT" ? "0%" :
                            selectedTrx.status === "SECURED_IN_ESCROW" ? "33%" :
                            selectedTrx.status === "DELIVERED_AWAITING_CONFIRMATION" ? "66%" : "100%"
                        }}
                      />
                    </div>

                    {[
                      { step: 1, label: "Invoice Audited", done: true },
                      { step: 2, label: "Cash Secured", done: selectedTrx.status !== "AWAITING_DEPOSIT" },
                      { step: 3, label: "Courier Dispatch", done: ["DELIVERED_AWAITING_CONFIRMATION", "RESOLVED_RELEASED", "RESOLVED_REFUNDED"].includes(selectedTrx.status) },
                      { step: 4, label: "Funds Disbursed", done: ["RESOLVED_RELEASED", "RESOLVED_REFUNDED"].includes(selectedTrx.status) },
                    ].map((step) => {
                      const isActive = step.done || selectedTrx.status === "DISPUTED";
                      return (
                        <div key={step.step} className="z-10 flex flex-col items-center">
                          <div className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center border-2 transition ${
                            step.done 
                              ? "bg-slate-900 border-emerald-500 text-emerald-400" 
                              : "bg-white border-slate-300 text-slate-500"
                          }`}>
                            {step.done ? <Check className={`w-4 h-4 ${theme === "dark" ? "text-emerald-400" : "text-emerald-650"}`} /> : step.step}
                          </div>
                          <span className={`text-[10px] font-bold mt-2 whitespace-nowrap ${
                            theme === "dark" ? "text-slate-400" : "text-slate-705"
                          }`}>{step.label}</span>
                        </div>
                      );
                    })}

                  </div>
                </div>

                {/* Central Body details splitting left (Terms) and right (AI Auditor) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  
                  {/* Left sub-column: Transaction details */}
                  <div className="md:col-span-7 space-y-4">
                    
                    {/* Item Details Card */}
                    <div className="space-y-3">
                      <div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest block ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}>Item/Service Description</span>
                        <h3 className={`font-extrabold text-base mt-0.5 ${theme === "dark" ? "text-white" : "text-slate-950 text-lg"}`}>{selectedTrx.itemName}</h3>
                      </div>
                      
                      <p className={`text-xs p-3 rounded-lg border leading-relaxed font-sans min-h-[50px] transition-colors ${
                        theme === "dark" ? "text-slate-300 bg-slate-950/40 border-slate-850" : "text-slate-800 bg-slate-50 border-slate-200 font-medium"
                      }`}>
                        {selectedTrx.itemDescription}
                      </p>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className={`p-2.5 rounded-lg border transition-colors ${
                          theme === "dark" ? "bg-slate-950/50 border-slate-850 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-800 font-semibold"
                        }`}>
                          <span className={`text-[9px] font-extrabold tracking-wider uppercase block ${theme === "dark" ? "text-slate-500" : "text-slate-500"}`}>Seller OPay</span>
                          <span className={`text-xs block truncate ${theme === "dark" ? "text-slate-300 animate-none" : "text-slate-950 font-bold"}`}>{selectedTrx.sellerName}</span>
                          <span className={`text-[10px] font-mono block ${theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"}`}>{selectedTrx.sellerPhone}</span>
                        </div>
                        <div className={`p-2.5 rounded-lg border transition-colors ${
                          theme === "dark" ? "bg-slate-950/50 border-slate-850 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-800 font-semibold"
                        }`}>
                          <span className={`text-[9px] font-extrabold tracking-wider uppercase block ${theme === "dark" ? "text-slate-500" : "text-slate-500"}`}>Buyer OPay</span>
                          <span className={`text-xs block truncate ${theme === "dark" ? "text-slate-300 animate-none" : "text-slate-950 font-bold"}`}>{selectedTrx.buyerName}</span>
                          <span className={`text-[10px] font-mono block ${theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"}`}>{selectedTrx.buyerPhone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Simulating OPay Action Desk */}
                    <div className={`border p-4 rounded-xl space-y-3 transition-colors ${
                      theme === "dark" ? "bg-slate-955/30 border-slate-850/50" : "bg-sky-50/50 border-sky-200"
                    }`}>
                      <h4 className={`text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5 ${
                        theme === "dark" ? "text-slate-300" : "text-sky-900 font-bold"
                      }`}>
                        <Shield className={`w-4 h-4 ${theme === "dark" ? "text-emerald-400" : "text-emerald-650"}`} /> OPay Safe Checkout & Wallet Portal
                      </h4>

                      <div className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${
                        theme === "dark" ? "bg-slate-950 border-slate-850" : "bg-white border-sky-300 shadow-sm"
                      }`}>
                        <div>
                          <span className={`text-[10px] uppercase tracking-wider block font-bold ${theme === "dark" ? "text-slate-500" : "text-sky-700"}`}>Escrow Payout</span>
                          <span className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-700 font-semibold"}`}>Funds held securely by TrustBridge</span>
                        </div>
                        <span className={`text-xl font-extrabold font-mono tracking-tight ${theme === "dark" ? "text-emerald-300" : "text-emerald-805"}`}>
                          ₦{selectedTrx.price.toLocaleString()}
                        </span>
                      </div>

                      {/* Transition Action Buttons */}
                      <div className="space-y-2 pt-1">
                        
                        {selectedTrx.status === "AWAITING_DEPOSIT" && (
                          <button
                            onClick={handleSecureDepositClick}
                            disabled={actionLoading}
                            className={`w-full py-3 font-extrabold text-xs uppercase tracking-wider rounded-xl transition duration-155 flex items-center justify-center gap-1.5 cursor-pointer ${
                              theme === "dark"
                                ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                                : "bg-emerald-650 text-white hover:bg-emerald-600 shadow-lg"
                            }`}
                            id="audit-pay-deposit-btn"
                          >
                            <DollarSign className="w-4 h-4" /> Secure Deposit NGN {selectedTrx.price.toLocaleString()}
                          </button>
                        )}

                        {selectedTrx.status === "SECURED_IN_ESCROW" && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleStatusAction("ship")}
                              disabled={actionLoading}
                              className={`py-2.5 font-bold text-xs uppercase rounded-lg border transition ${
                                theme === "dark"
                                  ? "bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                              }`}
                            >
                              Dispatch/Ship Item
                            </button>
                            <button
                              onClick={handleRaiseDispute}
                              disabled={actionLoading}
                              className={`py-2.5 font-bold text-xs uppercase rounded-lg border transition ${
                                theme === "dark"
                                  ? "bg-rose-950/30 border-rose-900/40 hover:bg-rose-950/50 text-rose-300"
                                  : "bg-rose-100 hover:bg-rose-155 border-rose-300 text-rose-800"
                              }`}
                            >
                              Raise Dispute
                            </button>
                          </div>
                        )}

                        {selectedTrx.status === "DELIVERED_AWAITING_CONFIRMATION" && (
                          <div className="space-y-2">
                            <div className={`border p-2.5 rounded-lg text-xs leading-relaxed text-center font-bold ${
                              theme === "dark"
                                ? "bg-slate-950/80 border-emerald-500/20 text-emerald-300/90"
                                : "bg-emerald-50 border-emerald-300 text-emerald-950"
                            }`}>
                              📦 <b>Delivery status update</b>: The seller indicates shipment is complete. Buyer has 72 hours to inspect physically and release funds, otherwise auto-disbursed.
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleStatusAction("release")}
                                disabled={actionLoading}
                                className={`py-2.5 font-bold text-xs uppercase rounded-lg transition border flex items-center justify-center gap-1 cursor-pointer ${
                                  theme === "dark"
                                    ? "bg-emerald-500/10 hover:bg-emerald-500/25 border-emerald-500 text-emerald-300"
                                    : "bg-emerald-50 hover:bg-emerald-100 border-emerald-600 text-emerald-805"
                                }`}
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Accept & Release
                              </button>
                              <button
                                onClick={handleRaiseDispute}
                                disabled={actionLoading}
                                className={`py-2.5 font-bold text-xs uppercase rounded-lg border transition ${
                                  theme === "dark"
                                    ? "bg-rose-950/30 border-rose-900/40 hover:bg-rose-950/50 text-rose-300"
                                    : "bg-rose-100 hover:bg-rose-155 border-rose-300 text-rose-800"
                                }`}
                              >
                                Dispute Item
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedTrx.status === "RESOLVED_RELEASED" && (
                          <div className={`p-3 rounded-lg text-xs text-center border flex items-center justify-center gap-1.5 ${
                            theme === "dark" ? "bg-slate-950 border-slate-850 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-700 font-bold"
                          }`}>
                            <CheckCircle className={`w-4 h-4 shrink-0 ${theme === "dark" ? "text-emerald-400" : "text-emerald-600"}`} />
                            <span>This escrow has been successfully closed. Funds disbursed to <b>{selectedTrx.sellerName}</b>'s OPay wallet on confirmation.</span>
                          </div>
                        )}

                        {selectedTrx.status === "RESOLVED_REFUNDED" && (
                          <div className={`p-3 rounded-lg text-xs text-center border flex items-center justify-center gap-1.5 ${
                            theme === "dark" ? "bg-slate-950 border-slate-850 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-750 font-bold"
                          }`}>
                            <CheckCircle className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>Escrow terminated. Funds refund credited to <b>{selectedTrx.buyerName}</b>'s OPay wallet.</span>
                          </div>
                        )}

                        {selectedTrx.status === "DISPUTED" && (
                          <div className={`border p-3.5 rounded-lg space-y-2 ${
                            theme === "dark" ? "bg-rose-500/10 border-rose-500/20" : "bg-rose-50 border-rose-200 text-rose-950"
                          }`}>
                            <span className={`text-xs font-black block uppercase tracking-wide ${theme === "dark" ? "text-rose-400" : "text-rose-850"}`}>📢 Escrow Claim in Arbitration State</span>
                            <p className={`text-[11px] leading-relaxed font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-800"}`}>
                              Either the buyer registers a claim or physical verification terms failed on log. TrustBridge AI Referee is actively evaluating evidence from both parties below.
                            </p>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                onClick={() => handleStatusAction("release")}
                                className={`py-2 text-[11px] font-bold rounded border text-center transition ${
                                  theme === "dark"
                                    ? "bg-slate-950 hover:bg-slate-900 text-emerald-400 border-emerald-500/20"
                                    : "bg-white hover:bg-slate-50 text-emerald-805 border-emerald-300 shadow-sm"
                                }`}
                              >
                                Release to Seller (Override)
                              </button>
                              <button
                                onClick={() => handleStatusAction("refund")}
                                className={`py-2 text-[11px] font-bold rounded border text-center transition ${
                                  theme === "dark"
                                    ? "bg-slate-950 hover:bg-slate-900 text-rose-400 border-rose-500/20"
                                    : "bg-white hover:bg-slate-50 text-rose-805 border-rose-300 shadow-sm"
                                }`}
                              >
                                Refund to Buyer (Override)
                              </button>
                            </div>
                          </div>
                        )}

                      </div>

                    </div>

                  </div>

                  {/* Right sub-column: Gemini AI Auditor / Fraud Risk Analyzer */}
                  <div className="md:col-span-5 space-y-4">
                    
                    {/* Gemini Fraud Radar Meter */}
                    <div className={`transition-all duration-200 border rounded-xl p-4 space-y-3.5 ${
                      theme === "dark" ? "bg-slate-955/60 border-slate-800" : "bg-emerald-50/40 border-emerald-300 shadow-xs"
                    }`}>
                      
                      <div className={`flex items-center justify-between border-b pb-2 ${
                        theme === "dark" ? "border-slate-850" : "border-emerald-200"
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className={`w-4 h-4 ${theme === "dark" ? "text-emerald-400" : "text-emerald-650"}`} />
                          <h4 className={`text-xs font-extrabold uppercase tracking-widest ${theme === "dark" ? "text-slate-300" : "text-emerald-950"}`}>Gemini Audit Radar</h4>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                          theme === "dark" ? "bg-slate-800 text-slate-400 border-slate-700/50" : "bg-white text-slate-700 border-slate-300"
                        }`}>Gemini 1.5 Flash</span>
                      </div>

                      {/* Circular-like Gauge score display */}
                      <div className="flex items-center gap-4 py-1" id="fraud-gauge-container">
                        <div className={`relative shrink-0 w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center ${
                          theme === "dark" ? "bg-slate-900 border-slate-850" : "bg-white border-slate-205"
                        }`}>
                          <span className={`text-2xl font-black font-mono leading-none ${
                            selectedTrx.fraudRisk.riskLevel === "High" ? (theme === "dark" ? "text-rose-500" : "text-rose-700") :
                            selectedTrx.fraudRisk.riskLevel === "Medium" ? (theme === "dark" ? "text-amber-400" : "text-amber-700") :
                            (theme === "dark" ? "text-emerald-400" : "text-emerald-700")
                          }`}>{selectedTrx.fraudRisk.score}</span>
                          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mt-1">RISK</span>
                        </div>

                        <div className="space-y-1">
                          <span className={`text-sm font-extrabold ${
                            selectedTrx.fraudRisk.riskLevel === "High" ? "text-rose-500" :
                            selectedTrx.fraudRisk.riskLevel === "Medium" ? "text-amber-805" :
                            "text-emerald-750"
                          }`}>{selectedTrx.fraudRisk.riskLevel} Fraud Risk</span>
                          <p className={`text-[10px] leading-relaxed line-clamp-3 ${theme === "dark" ? "text-slate-400" : "text-slate-750 font-bold"}`}>
                            {selectedTrx.fraudRisk.summary}
                          </p>
                        </div>
                      </div>

                      {/* Flags auditing tags */}
                      <div className="space-y-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-widest block ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}>Critical Assessment Flags:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedTrx.fraudRisk.flags.map((flag, idx) => (
                            <span 
                              key={idx} 
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                selectedTrx.fraudRisk.riskLevel === "High"
                                  ? theme === "dark" 
                                    ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                                    : "bg-rose-100/70 text-rose-950 border-rose-300"
                                  : theme === "dark"
                                    ? "bg-slate-900 text-slate-400 border-slate-800"
                                    : "bg-white text-slate-700 border-slate-300"
                              }`}
                            >
                              ⚠️ {flag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* AI advice */}
                      <div className={`p-2.5 rounded border text-[10px] leading-relaxed ${
                        theme === "dark" 
                          ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400" 
                          : "bg-white border-2 border-emerald-300 text-emerald-950 font-bold shadow-xs"
                      }`}>
                        <b>Escrow Guidelines Advice:</b> {selectedTrx.fraudRisk.advice}
                      </div>

                    </div>

                    {/* Vault Documents Portal & Dynamic PDF Generator */}
                    <div className={`p-3.5 rounded-xl border space-y-2 mt-4 text-left transition-all ${
                      theme === "dark" 
                        ? "bg-slate-950/45 border-slate-850" 
                        : "bg-slate-50 border-slate-200 shadow-sm"
                    }`} id="vault-documents-portal">
                      <div className="flex items-center gap-1.5 border-b pb-1.5 border-slate-205/60 dark:border-slate-850">
                        <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${theme === "dark" ? "text-slate-300" : "text-slate-900"}`}>Vault Documents Portal</h4>
                      </div>
                      <p className={`text-[9px] leading-relaxed ${theme === "dark" ? "text-slate-400" : "text-slate-650 font-semibold"}`}>
                        Generate the compiled high-security <b>Escrow Agreement and Deposit Receipt (PDF)</b>. Hand it to courier companies or use it in claim escalations.
                      </p>
                      <button
                        onClick={() => setShowAgreementPDF(true)}
                        className={`w-full py-2 font-black text-[10px] uppercase tracking-wider rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                          theme === "dark"
                            ? "bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-300 border border-emerald-500/20"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        }`}
                        id="btn-trigger-pdf-modal"
                      >
                        <FileText className="w-3.5 h-3.5" /> Generate Escrow Receipt (PDF)
                      </button>
                    </div>

                  </div>

                </div>

              </div>

                {/* Dispute / Evidence Logs Workspace Block */}
                {selectedTrx.status === "DISPUTED" && selectedTrx.dispute && (
                  <div className={`border-t pt-5 space-y-4 ${
                    theme === "dark" ? "border-slate-800" : "border-slate-200"
                  }`} id="dispute-evidence-hub">
                    
                    <div className={`flex items-center gap-2 border-b pb-2 ${
                      theme === "dark" ? "border-slate-850" : "border-slate-200"
                    }`}>
                      <Scale className="w-5 h-5 text-rose-500" />
                      <div>
                        <h3 className={`text-sm font-extrabold uppercase tracking-wider ${theme === "dark" ? "text-white" : "text-slate-950"}`}>AI Dispute Arbitration Office</h3>
                        <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-700 font-bold"}`}>Claims submitted center on: "<i>{selectedTrx.dispute.reason}</i>"</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      
                      {/* Left: evidence listing */}
                      <div className="lg:col-span-6 space-y-3">
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-800"}`}>Submitted Evidences Timeline</h4>
                        
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {selectedTrx.dispute.evidence.length === 0 ? (
                            <div className={`p-4 text-center text-xs border border-dashed rounded-lg ${
                              theme === "dark" ? "text-slate-500 bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-300 text-slate-700 font-medium"
                            }`}>
                              No evidence uploaded yet. Submit statements below.
                            </div>
                          ) : (
                            selectedTrx.dispute.evidence.map((ev, idx) => (
                              <div key={idx} className={`p-3 rounded-lg border text-xs transition ${
                                theme === "dark" ? "bg-slate-950/60 border-slate-850" : "bg-slate-50 border-slate-250 shadow-xs text-slate-950"
                              }`}>
                                <div className={`flex justify-between items-center mb-1.5 border-b pb-1 ${
                                  theme === "dark" ? "border-slate-850/55" : "border-slate-200"
                                }`}>
                                  <span className={`font-extrabold uppercase text-[9px] px-1.5 py-0.5 rounded ${
                                    ev.by === "buyer" 
                                      ? theme === "dark" ? "bg-slate-900 text-slate-300" : "bg-slate-250 text-slate-800"
                                      : theme === "dark" ? "bg-emerald-500/10 text-emerald-300" : "bg-emerald-50 text-emerald-800 border border-emerald-250"
                                  }`}>
                                    {ev.by === "buyer" ? "Buyer Claims" : "Seller Defense"}
                                  </span>
                                  <time className={`text-[9px] font-mono ${theme === "dark" ? "text-slate-500" : "text-slate-550 font-bold"}`}>
                                    {new Date(ev.submittedAt).toLocaleTimeString()}
                                  </time>
                                </div>
                                <p className={`leading-relaxed font-sans ${theme === "dark" ? "text-slate-300" : "text-slate-800 font-semibold"}`}>{ev.text}</p>
                                {ev.imageUrl && (
                                  <div className="mt-2.5 rounded-lg overflow-hidden border border-slate-850 bg-slate-950 aspect-video max-h-[110px] flex items-center justify-center">
                                    <img src={ev.imageUrl} alt="Uploaded dispute screenshot" className="object-cover w-full h-full opacity-90" referrerPolicy="no-referrer" />
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Interactive text upload */}
                        <form onSubmit={handleSubmitEvidence} className={`p-3 rounded-xl border space-y-3 transition ${
                          theme === "dark" ? "bg-slate-950/50 border-slate-850" : "bg-slate-100 border-slate-250"
                        }`}>
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${theme === "dark" ? "text-slate-400" : "text-slate-700"}`}>Add Dispute Proof / Statement</span>
                          
                          <div className="flex gap-4">
                            <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${theme === "dark" ? "text-slate-300" : "text-slate-800 font-bold"}`}>
                              <input 
                                type="radio" 
                                name="evBy" 
                                checked={evidenceBy === "buyer"}
                                onChange={() => setEvidenceBy("buyer")}
                                className="accent-emerald-550"
                              /> 
                              <span>As Buyer</span>
                            </label>
                            <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${theme === "dark" ? "text-slate-300" : "text-slate-800 font-bold"}`}>
                              <input 
                                type="radio" 
                                name="evBy" 
                                checked={evidenceBy === "seller"}
                                onChange={() => setEvidenceBy("seller")}
                                className="accent-emerald-550"
                              /> 
                              <span>As Seller</span>
                            </label>
                          </div>

                          <div className="space-y-1.5 pb-1">
                            <span className={`text-[10px] font-black uppercase tracking-wider block ${theme === "dark" ? "text-slate-400" : "text-slate-705"}`}>Attach Evidence Image (Simulated File)</span>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                {
                                  key: "mismatched",
                                  name: "📱 Damaged Screen",
                                  url: "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400&q=80"
                                },
                                {
                                  key: "waybill",
                                  name: "🧾 Waybill slip",
                                  url: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=400&q=80"
                                },
                                {
                                  key: "incorrect",
                                  name: "🔌 Bad Adaptor",
                                  url: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80"
                                }
                              ].map((att) => {
                                const isSel = selectedAttachment === att.url;
                                return (
                                  <button
                                    key={att.key}
                                    type="button"
                                    onClick={() => setSelectedAttachment(isSel ? "" : att.url)}
                                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition text-center truncate cursor-pointer ${
                                      isSel 
                                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-extrabold" 
                                        : theme === "dark" 
                                          ? "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800" 
                                          : "bg-white border-slate-300 text-slate-705 hover:bg-slate-50"
                                    }`}
                                  >
                                    {att.name}
                                  </button>
                                );
                              })}
                            </div>
                            {selectedAttachment && (
                              <div className="relative rounded-lg overflow-hidden aspect-video border border-slate-800 max-h-[85px] bg-slate-950 flex items-center justify-center">
                                <img src={selectedAttachment} alt="Attached preview" className="object-cover w-full h-full opacity-80" referrerPolicy="no-referrer" />
                                <span className="absolute bottom-1 right-2 text-[8px] bg-black/80 text-white font-black px-1.5 py-0.5 rounded">Attached ready</span>
                              </div>
                            )}
                          </div>

                          <div className="relative">
                            <textarea
                              value={evidenceText}
                              onChange={(e) => setEvidenceText(e.target.value)}
                              placeholder={`Describe what went incorrect from the ${evidenceBy} perspective, including delivery delays or damages...`}
                              required
                              rows={2}
                              className={`w-full rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition ${
                                theme === "dark" ? "bg-slate-900 border border-slate-800 text-slate-100" : "bg-white border-2 border-slate-250 text-slate-950 font-bold placeholder:text-slate-450"
                              }`}
                              id="dispute-evidence-textarea"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={actionLoading}
                            className={`w-full py-2 border font-bold text-xs uppercase rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              theme === "dark"
                                ? "bg-slate-800 hover:bg-slate-750 text-slate-100 border-slate-700"
                                : "bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-xs"
                            }`}
                            id="submit-dispute-evidence-btn"
                          >
                            <Send className="w-4 h-4 text-emerald-500" />
                            {actionLoading ? "Processing Arbitration Details..." : "Upload Evidence Box"}
                          </button>
                        </form>

                      </div>

                      {/* Right: AI referee recommendation report */}
                      <div className={`rounded-xl p-4 space-y-3.5 border transition ${
                        theme === "dark" ? "bg-slate-950/50 border-blue-500/10" : "bg-cyan-50 border-cyan-200"
                      }`}>
                        
                        <div className={`flex items-center gap-1.5 border-b pb-2 ${
                          theme === "dark" ? "border-slate-850" : "border-cyan-200"
                        }`}>
                          <MessageSquare className={`w-4 h-4 ${theme === "dark" ? "text-cyan-400" : "text-cyan-700"}`} />
                          <h4 className={`text-xs font-extrabold uppercase tracking-widest ${theme === "dark" ? "text-cyan-300" : "text-cyan-900"}`}>TrustBridge AI Referee Recommendation</h4>
                        </div>

                        {selectedTrx.dispute.aiRecommendation ? (
                          <div className="space-y-3" id="ai-recommendation-card">
                            
                            {/* Outcome Badge split */}
                            <div className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border transition ${
                              theme === "dark" ? "bg-slate-900 border-slate-850" : "bg-white border-cyan-300 shadow-xs"
                            }`}>
                              <div>
                                <span className={`text-[9px] uppercase font-bold block ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}>Judicial advice:</span>
                                <span className={`text-xs font-black ${theme === "dark" ? "text-white" : "text-slate-950"}`}>{selectedTrx.dispute.aiRecommendation.recommendation.replace(/_/g, " ")}</span>
                              </div>
                              {selectedTrx.dispute.aiRecommendation.splitDetails && (
                                <span className={`text-xs font-extrabold px-3 py-1 rounded border font-mono ${
                                  theme === "dark" 
                                    ? "bg-blue-500/15 text-cyan-300 border-blue-400/20" 
                                    : "bg-cyan-100 text-cyan-800 border-cyan-300"
                                }`}>
                                  {selectedTrx.dispute.aiRecommendation.splitDetails}
                                </span>
                              )}
                            </div>

                            <p className={`text-[11px] leading-relaxed font-sans ${theme === "dark" ? "text-slate-300" : "text-slate-805 font-semibold"}`}>
                              📌 <b>Referee Verdict Summary:</b> {selectedTrx.dispute.aiRecommendation.summary}
                            </p>

                            <blockquote className={`pl-3 py-1.5 text-[11px] leading-relaxed font-sans italic rounded-r ${
                              theme === "dark" 
                                ? "border-l-2 border-emerald-500/40 text-emerald-300/95 bg-slate-900/40" 
                                : "border-l-4 border-emerald-500 text-emerald-950 bg-emerald-50/50 font-bold shadow-xs"
                            }`}>
                              "{selectedTrx.dispute.aiRecommendation.explanationToBoth}"
                            </blockquote>

                            {/* Option to adopt AI recommendation splits */}
                            <button
                              onClick={() => {
                                const rec = selectedTrx.dispute?.aiRecommendation?.recommendation;
                                if (rec === "RELEASE_TO_SELLER") handleStatusAction("release");
                                else if (rec === "REFUND_TO_BUYER") handleStatusAction("refund");
                                else handleStatusAction("release", { splitUsed: true }); // Mock split
                              }}
                              className={`w-full py-2 font-bold text-xs uppercase tracking-wider rounded-lg transition border cursor-pointer ${
                                theme === "dark"
                                  ? "bg-gradient-to-r from-cyan-400/20 to-emerald-400/20 hover:from-cyan-400/35 hover:to-emerald-400/35 border-cyan-500/30 text-white"
                                  : "bg-cyan-600 hover:bg-cyan-700 border-cyan-700 text-white shadow-md font-extrabold"
                              }`}
                            >
                              Accept AI Verdict & Release Escrows
                            </button>

                          </div>
                        ) : (
                          <div className={`py-12 text-center text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-600 font-bold"}`}>
                            Please upload initial evidence logs to let Gemini clear the claims automatically.
                          </div>
                        )}

                      </div>

                    </div>

                  </div>
                )}

            </div>
          ) : (
            <div className={`border rounded-2xl p-12 text-center transition ${
              theme === "dark" 
                ? "bg-slate-900 border-slate-800 text-slate-400" 
                : "bg-white border-slate-200 text-slate-600 shadow-lg font-medium"
            }`} id="blankstate-card">
              <Clock className={`w-12 h-12 mx-auto mb-4 ${theme === "dark" ? "text-slate-600" : "text-slate-300"}`} />
              <p className="text-sm">Please register your escrow using the "+ New Escrow" action, or search/select one in the left menu.</p>
            </div>
          )}

        </section>

      </main>

      {/* DISPUTE EXPLAIN/INTENSIFY DIALOG */}
      {showDisputeModal && selectedTrx && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="dispute-modal">
          <div className={`border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl transition-colors ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
          }`}>
            
            <div className={`flex items-center gap-2 border-b pb-3 ${
              theme === "dark" ? "border-slate-800" : "border-slate-205"
            }`}>
              <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
              <h3 className={`text-sm font-black uppercase tracking-wider ${theme === "dark" ? "text-white" : "text-slate-950"}`}>Raise Cargo/Item Dispute</h3>
            </div>

            <div className={`space-y-2 text-xs ${theme === "dark" ? "text-slate-300" : "text-slate-800 font-semibold"}`}>
              <p>
                You are about to flag transaction <b>{selectedTrx.id}</b> under disputed claims. This stops automatic OPay disbursements immediately.
              </p>
              <p className={`${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                Please specify the accurate reasons why the merchandise is mismatched or defective below. TrustBridge AI Referee will guide arbitration.
              </p>
            </div>

            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="e.g. Broken screen inside packaging, items failed to power on, seller sent standard lace instead of premium cotton..."
              rows={3}
              required
              className={`w-full rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition ${
                theme === "dark" ? "bg-slate-955 border border-slate-800 text-slate-100" : "bg-slate-50 border-2 border-slate-250 text-slate-950 font-semibold placeholder:text-slate-450"
              }`}
              id="form-dispute-reason"
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => {
                  setShowDisputeModal(false);
                  setDisputeReason("");
                }}
                className={`px-3.5 py-2 rounded transition cursor-pointer border ${
                  theme === "dark" 
                    ? "bg-slate-800 hover:bg-slate-755 text-slate-300 border-slate-700" 
                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 font-bold"
                }`}
              >
                Go Back
              </button>
              <button
                onClick={submitDisputeNotice}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-extrabold transition cursor-pointer shadow-sm text-center"
                id="modal-confirm-dispute"
              >
                Raise Dispute Now
              </button>
            </div>

          </div>
        </div>
      )}

      {/* OPAY ESCROW PAY-IN SECURE PORTAL GATEWAY MODAL */}
      {showOPayModal && selectedTrx && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="opay-payment-modal">
          <div className={`border rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl transition-colors ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
          }`}>
            
            {/* OPay Brand Header */}
            <div className="bg-emerald-600 p-5 text-white flex justify-between items-center relative">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-800 font-black text-lg">
                  O
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide">OPay TrustVault Pay</h3>
                  <p className="text-[10px] text-emerald-100 font-semibold uppercase tracking-wider">Secured Escrow Ingress</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-bold">
                <Shield className="w-3 h-3 text-emerald-300 animate-pulse" /> SafeVault Holding
              </div>
            </div>

            {/* Modal Contents based on Step */}
            <div className="p-5 md:p-6 space-y-5">
              
              {/* Common Info Box: Deal Details */}
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                theme === "dark" ? "bg-slate-950/60 border-slate-850" : "bg-slate-50 border-slate-200"
              }`}>
                <div>
                  <span className="text-slate-500 font-semibold block uppercase text-[8px] tracking-wide">Escrow Cargo</span>
                  <span className={`font-bold block truncate max-w-[200px] ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{selectedTrx.itemName}</span>
                  <span className="text-slate-400 block text-[10px]">Merchant: {selectedTrx.sellerName}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 font-semibold block uppercase text-[8px] tracking-wide">Funds Required</span>
                  <span className="font-mono text-base font-black text-emerald-600">₦{selectedTrx.price.toLocaleString()}</span>
                </div>
              </div>

              {/* STEP 1: SELECT METHOD */}
              {opayStep === "method" && (
                <div className="space-y-4" id="opay-step-method">
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-wider block ${theme === "dark" ? "text-slate-350" : "text-slate-800"}`}>Select OPay Payout Account</label>
                    <div className="space-y-2">
                      {[
                        {
                          id: "wallet",
                          title: `OPay Personal Balance (Wallet: ${selectedTrx.buyerPhone || "+2347065..."})`,
                          desc: "Instant secured credit hold; Zero processing commissions",
                          badge: "Instant"
                        },
                        {
                          id: "transfer",
                          title: "Instant Bank Ingress Transfer (OPay Terminal)",
                          desc: "Pay from Kuda, Moniepoint, Zenith or any commercial banking app",
                          badge: "+₦0 fee"
                        },
                        {
                          id: "card",
                          title: "OPay Debit Card / Visa / MasterCard Express",
                          desc: "Quick transactional authentication using tokenized debit cards",
                          badge: "Secure"
                        }
                      ].map((method) => {
                        const isSelected = paymentMethod === method.id;
                        return (
                          <div
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id as any)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                              isSelected 
                                ? "border-emerald-500 bg-emerald-55/10 text-emerald-400"
                                : theme === "dark" ? "bg-slate-950/40 border-slate-850 hover:bg-slate-900/60" : "bg-white border-slate-200 hover:bg-slate-50 shadow-sm"
                            }`}
                          >
                            <div>
                              <h4 className={`text-xs font-bold ${isSelected ? "text-emerald-400 font-black" : theme === "dark" ? "text-slate-200" : "text-slate-900"}`}>{method.title}</h4>
                              <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-600 font-medium"}`}>{method.desc}</p>
                            </div>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                              isSelected 
                                ? "bg-emerald-500 text-slate-950 font-black border-emerald-400" 
                                : "text-slate-400 border-slate-700 bg-slate-800"
                            }`}>{method.badge}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 text-xs pt-1">
                    <button
                      onClick={() => setShowOPayModal(false)}
                      className={`w-full py-2.5 rounded-xl border font-bold transition text-center cursor-pointer ${
                        theme === "dark" ? "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700" : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                      }`}
                    >
                      Dismiss Portal
                    </button>
                    <button
                      onClick={() => setOpayStep("pin")}
                      className={`w-full py-2.5 rounded-xl font-extrabold transition text-center cursor-pointer ${
                        theme === "dark" ? "bg-emerald-400 hover:bg-emerald-300 text-slate-950" : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                      }`}
                    >
                      Authorize with O-PIN
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: SECURE PIN */}
              {opayStep === "pin" && (
                <div className="space-y-4 text-center" id="opay-step-pin">
                  <div className="space-y-1 max-w-xs mx-auto">
                    <label className={`text-[10px] font-black uppercase tracking-wider block ${theme === "dark" ? "text-slate-355" : "text-slate-800"}`}>Enter 4-Digit OPay billing PIN</label>
                    <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-600 font-bold"}`}>Authorize secure holding within OPay Vault infrastructure</p>
                    
                    {/* Visual PIN circles */}
                    <div className="flex justify-center gap-4 py-4">
                      {[0, 1, 2, 3].map((idx) => {
                        const filled = pinDigits.length > idx;
                        return (
                          <div
                            key={idx}
                            className={`w-4 h-4 rounded-full border-2 transition ${
                              filled 
                                ? "bg-emerald-500 border-emerald-400 scale-110" 
                                : theme === "dark" ? "border-slate-800 bg-slate-950" : "border-slate-300 bg-slate-50"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* CUSTOM NUMERIC TACTILE KEYPAD */}
                  <div className="max-w-xs mx-auto grid grid-cols-3 gap-2 pb-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⇐"].map((keyChar) => {
                      return (
                        <button
                          key={keyChar}
                          type="button"
                          onClick={() => {
                            if (keyChar === "Clear") {
                              setPinDigits([]);
                            } else if (keyChar === "⇐") {
                              setPinDigits(prev => prev.slice(0, -1));
                            } else {
                              if (pinDigits.length < 4) {
                                const nextDigits = [...pinDigits, keyChar];
                                setPinDigits(nextDigits);
                                if (nextDigits.length === 4) {
                                  // Auto-trigger loading processing
                                  triggerOPayHoldingProcess();
                                }
                              }
                            }
                          }}
                          className={`py-3 rounded-xl text-center font-bold font-mono transition text-sm cursor-pointer ${
                            ["Clear", "⇐"].includes(keyChar)
                              ? theme === "dark" 
                                ? "bg-slate-950 text-slate-450 hover:bg-slate-900 border border-slate-850" 
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
                              : theme === "dark"
                                ? "bg-slate-950 hover:bg-slate-800 text-white border border-slate-850"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-950 border border-slate-200 font-extrabold"
                          }`}
                        >
                          {keyChar}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setOpayStep("method")}
                    className={`text-[10px] font-bold underline ${theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-700 hover:text-slate-900"}`}
                  >
                    ← Back to Payment Sources
                  </button>
                </div>
              )}

              {/* STEP 3: LOADING HOLD */}
              {opayStep === "processing" && (
                <div className="py-8 text-center space-y-4" id="opay-step-processing">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin" />
                    <Shield className="absolute inset-4 w-8 h-8 text-emerald-400 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h4 className={`text-sm font-extrabold ${theme === "dark" ? "text-white" : "text-slate-950"}`}>Securing TrustBridge Holdings</h4>
                    <p className={`text-xs animate-pulse text-emerald-400 font-bold`}>{opayLoadingText}</p>
                  </div>
                </div>
              )}

              {/* STEP 4: SUCCESS CONFIRMED */}
              {opayStep === "success" && (
                <div className="py-6 text-center space-y-4" id="opay-step-success">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className={`text-base font-black ${theme === "dark" ? "text-white" : "text-slate-950"}`}>Naira Payment Locked Successfully!</h4>
                    <p className={`text-xs px-4 leading-relaxed ${theme === "dark" ? "text-slate-400" : "text-slate-700 font-semibold"}`}>
                      ₦{selectedTrx.price.toLocaleString()} safely stored inside <b>OPay Vault Holdings</b>. Funds will only clear to <b>{selectedTrx.sellerName}</b>'s wallet after waybill code is verified.
                    </p>
                  </div>
                  <div className={`border p-3 rounded-2xl max-w-xs mx-auto text-[10px] leading-relaxed ${
                    theme === "dark" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-450" : "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                  }`}>
                    🛡️ OPay Fraud assessment health: <b>COMPLIANT</b>. Security hold has been initialized.
                  </div>
                  <button
                    onClick={() => {
                      setShowOPayModal(false);
                      setIsInviteView(false);
                    }}
                    className={`w-full max-w-xs py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer bg-emerald-650 hover:bg-emerald-600 text-white shadow-lg`}
                  >
                    Return to Safe Desk Portal
                  </button>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* COMPLIANT ESCROW AGREEMENT CERTIFICATE & RECEIPT PREVIEW MODAL */}
      {showAgreementPDF && selectedTrx && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto" id="escrow-document-overlay">
          <div className={`rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl transition-all border flex flex-col max-h-[90vh] ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
          }`}>
            
            {/* Control Bar (Hide during Printer operation) */}
            <div className="p-4 bg-emerald-600 text-white flex justify-between items-center shrink-0 no-print-btn">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-100" />
                <div>
                  <h3 className="font-extrabold text-xs md:text-sm tracking-wide">Certified Escrow Document</h3>
                  <p className="text-[9px] text-emerald-100 uppercase tracking-widest font-bold">PDF agreement generation workspace</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 transition text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  id="btn-trigger-pdf-print"
                >
                  <Printer className="w-3.5 h-3.5" /> Save / Print PDF
                </button>
                <button
                  onClick={() => setShowAgreementPDF(false)}
                  className="p-1 px-2.5 rounded-lg bg-black/20 hover:bg-black/35 text-white transition text-xs font-bold cursor-pointer"
                  id="btn-close-pdf-modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable preview wrapper (visible on screen but prints beautifully too) */}
            <div className="p-4 md:p-6 overflow-y-auto bg-slate-950/5 flex justify-center flex-1">
              
              {/* THE PHYSICAL CUSTOM SECURE RECEIPT PAPER */}
              <div 
                id="printable-pdf-modal" 
                className="bg-[#fdfbfa] border-4 border-double border-oldgold-700 p-6 md:p-10 max-w-[210mm] w-full text-slate-900 shadow-xl relative font-serif text-left"
              >
                {/* Vintage Double Frame Styling */}
                <div className="absolute inset-2 border border-emerald-900/10 pointer-events-none" />
                <div className="absolute inset-4 border border-teal-850/5 pointer-events-none" />

                {/* Secure Compliance Holographic watermarked badge */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 opacity-[0.035] pointer-events-none flex items-center justify-center border-8 border-dashed border-emerald-950 rounded-full">
                  <div className="text-center font-sans tracking-widest uppercase font-black text-2xl rotate-12 text-emerald-950">
                    TRUSTBRIDGE SECURED<br/>VAULT HOLDING HOLDING HOLDING
                  </div>
                </div>

                {/* Document Header letterhead */}
                <div className="text-center space-y-2 border-b pb-4 border-slate-300">
                  <div className="flex justify-center items-center gap-2">
                    <span className="font-sans font-black bg-emerald-800 text-white rounded px-2 py-1 text-md">TB</span>
                    <span className="font-sans tracking-[0.25em] text-slate-800 text-lg uppercase font-bold">TrustBridge Systems</span>
                  </div>
                  <h1 className="text-sm md:text-base font-black tracking-widest uppercase text-slate-900 font-sans">
                    Escrow Trust agreement & SafeHolding Receipt
                  </h1>
                  <p className="text-[9px] font-sans text-slate-505 font-bold uppercase tracking-wider">
                    Powered in Cooperation with OPay SafeVault API holds & Gemini Auditory Radar
                  </p>
                </div>

                {/* Sub-header credentials */}
                <div className="grid grid-cols-2 gap-4 text-[10px] md:text-xs font-sans py-4 border-b border-slate-200">
                  <div className="space-y-0.5">
                    <span className="text-slate-450 uppercase text-[8px] font-black block">Contract Identifier</span>
                    <span className="font-mono font-bold text-slate-800 block uppercase">ESC-OP-{selectedTrx.id.substring(0,8).toUpperCase()}-2026</span>
                    <span className="text-[9px] text-slate-500 font-bold block">Ref: OPay Vaulting Account API</span>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-slate-450 uppercase text-[8px] font-black block">Generation Timestamp</span>
                    <span className="font-mono font-bold text-slate-800 block">June 9, 2026 @ 23:25 UTC</span>
                    <span className="text-[9px] font-bold block text-emerald-700">Digital Seal Status: VALID / COMPLIANT</span>
                  </div>
                </div>

                {/* Main Legal Clauses / Terms statement */}
                <div className="py-4 space-y-4 text-xs font-sans">
                  
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-200">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-black uppercase text-slate-500">Receipt Vault State</span>
                      <span className="text-xs font-bold font-sans text-slate-850 block">Funds Locked Status:</span>
                    </div>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${
                      selectedTrx.status === "AWAITING_DEPOSIT" ? "bg-amber-100 text-amber-800 border-amber-300" :
                      selectedTrx.status === "SECURED_IN_ESCROW" ? "bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse" :
                      selectedTrx.status === "DELIVERED_AWAITING_CONFIRMATION" ? "bg-sky-100 text-sky-800 border-sky-300" :
                      selectedTrx.status === "RESOLVED_RELEASED" ? "bg-emerald-800 text-white border-emerald-900" :
                      selectedTrx.status === "RESOLVED_REFUNDED" ? "bg-rose-100 text-rose-800 border-rose-300" :
                      "bg-slate-300 text-slate-800 border-slate-400"
                    }`}>
                      {selectedTrx.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Transaction Particulars Grid */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Section I: Contract Parties Particulars</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg space-y-0.5 border border-slate-100">
                        <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Buyer OPay Account</span>
                        <span className="font-bold text-slate-800 block text-xs">{selectedTrx.buyerName}</span>
                        <span className="font-mono text-[10px] block text-slate-505">{selectedTrx.buyerPhone}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg space-y-0.5 border border-slate-100">
                        <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Seller OPay Account</span>
                        <span className="font-bold text-slate-800 block text-xs">{selectedTrx.sellerName}</span>
                        <span className="font-mono text-[10px] block text-slate-505">{selectedTrx.sellerPhone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Declared Asset Specifications */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Section II: Declared Trade Cargo</h3>
                    <div className="p-3 bg-[#faf7f5] rounded-xl border border-slate-200 font-sans space-y-2">
                      <div className="flex justify-between items-center border-b pb-2 border-slate-200">
                        <div>
                          <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Item / Cargo Name</span>
                          <span className="font-black text-slate-800 text-xs">{selectedTrx.itemName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Secured Vault Value</span>
                          <span className="font-black font-mono text-emerald-800 text-sm">₦{selectedTrx.price.toLocaleString()}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Trade Specifications & Conditions</span>
                        <p className="text-[10px] leading-relaxed text-slate-650 font-sans italic">{selectedTrx.itemDescription}</p>
                      </div>
                    </div>
                  </div>

                  {/* Compliance Assessment */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Section III: Automated Compliance Assessment</h3>
                    <div className="p-3 rounded-xl border bg-emerald-50/50 border-emerald-200 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span className="text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider">Gemini 1.5 Compliance Audit Passed</span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-slate-700">
                        <b>Gemini Risk assessment rating:</b> {selectedTrx.fraudRisk.score}/100 ({selectedTrx.fraudRisk.riskLevel} Risk). {selectedTrx.fraudRisk.summary}
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono italic">
                        Secured under system API checksum: {selectedTrx.fraudRisk.flags.join(", ") || "NO_COMPLIANCE_FLAGS_RAISED"}
                      </p>
                    </div>
                  </div>

                  {/* Legalese Terms */}
                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg text-[9px] leading-relaxed text-slate-500 border border-slate-200 transition-colors">
                    <p className="font-bold text-slate-700">📜 OPay Vault Holding Covenants:</p>
                    <p>1. Buyer funds are securely tokenized with zero operational exposure inside OPay's high-liquidity secure custody.</p>
                    <p>2. Physical dispatch terms require verifiable waybills; release actions only trigger upon buyer confirmation or successful Gemini arbitration verdicts.</p>
                    <p>3. This document acts as administrative evidence for legal courier delivery agents or standard merchant accounting record filing.</p>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-4 pt-4 text-center text-[9px]">
                    <div className="space-y-3">
                      <div className="h-6 flex items-end justify-center font-mono text-slate-400 font-bold italic">
                        {selectedTrx.buyerName.substring(0, 10)}
                      </div>
                      <div className="border-t border-slate-300 pt-1">
                        <span className="font-bold text-slate-750 block">Buyer Signature</span>
                        <span className="text-slate-400 block font-mono text-[8px]">{selectedTrx.buyerPhone}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-6 flex items-end justify-center font-mono text-slate-405 font-bold italic">
                        {selectedTrx.sellerName.substring(0, 10)}
                      </div>
                      <div className="border-t border-slate-300 pt-1">
                        <span className="font-bold text-slate-750 block">Seller Signature</span>
                        <span className="text-slate-400 block font-mono text-[8px]">{selectedTrx.sellerPhone}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-6 flex items-center justify-center font-mono font-bold text-emerald-800 text-[8px]">
                        ✓ VERIFIED BY Ref-AI
                      </div>
                      <div className="border-t border-slate-300 pt-1">
                        <span className="font-bold text-emerald-950 block">TrustBridge Seal</span>
                        <span className="text-emerald-700 block font-mono text-[7.5px]">API Stamp #OUU-098</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Secure certificate footer */}
                <div className="text-center pt-4 border-t border-slate-205 text-[8.5px] text-slate-450 font-sans tracking-wide">
                  Olabisi Onabanjo University Escrow Project • Secured through OPay Safe Desk API Systems. Confidential.
                </div>

              </div>

            </div>

            {/* Modal Footer warning */}
            <div className={`p-4 border-t text-center text-[10px] no-print-btn ${theme === "dark" ? "border-slate-850" : "border-slate-200"}`}>
              💡 Tip: Click `Save / Print PDF` to export this document into a high-resolution, scale-free A4 PDF receipt on your system.
            </div>

          </div>
        </div>
      )}

      {/* Technical Footers */}
      <footer className={`border-t py-6 text-center text-xs space-y-1.5 transition-all ${
        theme === "dark" 
          ? "border-slate-900 bg-slate-950 text-slate-500" 
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`} id="main-footer">
        <p className="font-semibold">Copyright © 2026 TrustBridge Team — Olabisi Onabanjo University, Ogun State. All Rights Reserved.</p>
        <p className="text-[10px]">Built inside AI Studio Preview environment with node fullstack engine integrations.</p>
      </footer>

    </div>
  );
}
