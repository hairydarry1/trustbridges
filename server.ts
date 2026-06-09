/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, EscrowStatus } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database for Escrows
let transactionsList: Transaction[] = [
  {
    id: "TB-72910",
    sellerId: "seller_kazeem",
    sellerPhone: "+2348031112222",
    sellerName: "Kazeem Electronics",
    buyerPhone: "+2347065554444",
    buyerName: "Emeka Uzor",
    itemName: "iPhone 13 Pro Max (128GB)",
    itemDescription: "Neat London used iPhone 13 Pro Max, status 98% battery health, gold color. Buyer will inspect physically on delivery within Lagos before confirmation.",
    price: 450000,
    status: "AWAITING_DEPOSIT",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    paymentLink: "", // Will be populated dynamically
    fraudRisk: {
      score: 15,
      riskLevel: "Low",
      flags: ["Lagos physical inspectability on delivery indicated"],
      summary: "This transaction appears legitimate with normal device pricing and specific inspectability instructions matching typical safe high-value deliveries.",
      advice: "Ensure the physical inspection is carried out in a public, safe area (e.g., inside an OPay agent shop or bank lobby)."
    }
  },
  {
    id: "TB-58291",
    sellerId: "seller_stylehub",
    sellerPhone: "+2348149990000",
    sellerName: "StyleHub Lagos",
    buyerPhone: "+2349023334444",
    buyerName: "Chioma Nnaji",
    itemName: "Designer Ankara Gown + Matching Scarf",
    itemDescription: "Custom luxury tailored blue Ankara print gown. Shipped via GIG Logistics to Enugu. Photos sent to customer prior to packaging.",
    price: 32000,
    status: "SECURED_IN_ESCROW",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(), // 18 hours ago
    paymentLink: "",
    fraudRisk: {
      score: 25,
      riskLevel: "Low",
      flags: ["Detailed item custom sizing provided"],
      summary: "Moderate volume transaction with highly customized item requirements and logistics tracking. Low likelihood of duplicate ghost-shop scam.",
      advice: "Verify tail-side dimensions match Chioma's requirements, and check GIG Logistics transit tracking link regularly."
    }
  },
  {
    id: "TB-40182",
    sellerId: "seller_alaba",
    sellerPhone: "+2348057778888",
    sellerName: "Alaba Traders",
    buyerPhone: "+2347038889999",
    buyerName: "Tunde Bakare",
    itemName: "Refurbished Hp Elitebook 840 G6",
    itemDescription: "Core i5, 8GB RAM, 256GB SSD, working perfectly, original charger included. Tested heavily before dispatch.",
    price: 180000,
    status: "DISPUTED",
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
    paymentLink: "",
    fraudRisk: {
      score: 42,
      riskLevel: "Medium",
      flags: ["Refurbished computer high-dispute category"],
      summary: "Hardware transactions on Alaba market are in a high-risk category for delivery disputes, demanding strict verification of functional checks.",
      advice: "Make sure buyer records an unboxing video to confirm no shipping damage occurred."
    },
    dispute: {
      raisedBy: "buyer",
      reason: "Laptop screen is flickering violently and battery won't hold charge for up to 10 minutes, completely contrary to 'working perfectly' description.",
      raisedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      evidence: [
        {
          by: "buyer",
          text: "I received the laptop this morning from Alaba Traders. On turning it on, the screen is severely flickering. After 5 minutes, it died completely despite charging. Look at the attached description: 'Tested heavily and works perfectly'. This is clearly false and I want a full refund so I can buy another laptop.",
          submittedAt: new Date(Date.now() - 3600000 * 11).toISOString()
        },
        {
          by: "seller",
          text: "My brother, we tested this machine inside Alaba plaza 3 times before putting it into the dispatch box. Tunde even saw the video on WhatsApp! The damage must have come from the rough riding of the logistic boy. I cannot take back a broken laptop unless the buyer pays for screen replacement.",
          submittedAt: new Date(Date.now() - 3600000 * 9).toISOString()
        }
      ],
      aiRecommendation: {
        summary: "The dispute centers on a refurbished HP Elitebook which the buyer reports arrived with a flickering screen and weak battery. The seller insists the unit was perfect when tested in Alaba and shifts blame to the logistics company.",
        recommendation: "SPLIT_FUNDS",
        splitDetails: "70% Refund to Buyer / 30% Released to Seller",
        explanationToBoth: "Based on transaction standards, sellers bear the ultimate responsibility for ensuring transit safe packaging or choosing insured logistics in consumer deliveries. Since the unit was confirmed broken on immediate arrival, a majority refund is issued to the buyer. The seller receives a 30% payout to cushion parts salvaged or covers minor repair if returned, or to encourage shipping compensation filings."
      }
    }
  }
];

// Lazy Gemini client builder to prevent boot crashes when API key is missing
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY is not defined or is a placeholder. Server will fallback to mock-AI simulation mode.");
    return null;
  }
  
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Helper to formulate self-referential payment links
function getBaseUrl(req: any): string {
  if (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") {
    return process.env.APP_URL;
  }
  const host = req.get("host") || "localhost:3000";
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  return `${protocol}://${host}`;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Get all transactions
app.get("/api/transactions", (req, res) => {
  const baseUrl = getBaseUrl(req);
  const detailedTransactions = transactionsList.map(t => ({
    ...t,
    paymentLink: `${baseUrl}/?trxId=${t.id}`
  }));
  res.json(detailedTransactions);
});

// 2. Get specific transaction
app.get("/api/transactions/:id", (req, res) => {
  const transaction = transactionsList.find(t => t.id === req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found." });
  }
  const baseUrl = getBaseUrl(req);
  res.json({
    ...transaction,
    paymentLink: `${baseUrl}/?trxId=${transaction.id}`
  });
});

// 3. Create a transaction & Analyze Fraud using Gemini
app.post("/api/transactions", async (req, res) => {
  const {
    sellerPhone,
    sellerName,
    buyerPhone,
    buyerName,
    itemName,
    itemDescription,
    price
  } = req.body;

  if (!sellerName || !sellerPhone || !buyerName || !buyerPhone || !itemName || !price) {
    return res.status(400).json({ error: "Required fields are missing." });
  }

  const transactionId = `TB-${Math.floor(10000 + Math.random() * 90000)}`;
  const numericPrice = Number(price);

  let fraudRiskResult = {
    score: 20,
    riskLevel: "Low" as "Low" | "Medium" | "High",
    flags: ["Manual fallback estimation active"],
    summary: "Simulated parameters pass standard checks. Safe to proceed under OPay secure wallet holdings.",
    advice: "Perform basic check logic when receiving details on delivery."
  };

  const client = getGeminiClient();
  if (client) {
    try {
      const systemInstruction = `
        You are TrustBridge's real-time AI compliance and fraud auditor for Nigerian digital transactions.
        Your job is to analyze the transaction details, buyer/seller metadata, item description, and price (denominated in Nigerian Naira NGN) to produce a structured JSON report.
        
        Look for typical merchant scam patterns in Nigeria:
        - Outrageously low prices for high-end electronics (e.g., iPhone 15 for NGN 150k is 100% scam).
        - Social media ghost seller red-flags (e.g., 'must pay before viewing', 'customs clearing fee needed', 'strictly no physical meeting').
        - Urgency or pressuring language' (e.g., 'promo runs out in 2 hours', 'no returns', 'limited stock fast pay').
        - Vague or defensive descriptions (e.g., 'working somehow', 'cannot guarantee', 'no live photos').
        
        Ensure your score (0 to 100) corresponds to safety:
        - 0 to 30: Low Risk. Standard prices, detailed description, physical inspection welcome, normal timeline.
        - 31 to 69: Medium Risk. Slightly undervalued luxury item, vague shipment terms, lack of clarity.
        - 70 to 100: High Risk. Red flag terms (paying custom duty, gift-card payments, extremely cheap luxury goods, defensive text).
      `;

      const userPrompt = `
        Evaluate this newly registered transaction:
        Item Name: "${itemName}"
        Item Description: "${itemDescription}"
        Amount: NGN ${numericPrice.toLocaleString("en-NG")}
        Seller Name: "${sellerName}"
        Buyer Name: "${buyerName}"
        
        Generate a structured JSON output with:
        score: number,
        riskLevel: "Low" | "Medium" | "High",
        flags: string[],
        summary: string,
        advice: string
      `;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER, description: "Risk score from 0 (completely safe) to 100 (definitely fraud)" },
              riskLevel: { type: Type.STRING, description: "Must be 'Low' (0-30), 'Medium' (31-69), or 'High' (70-100)" },
              flags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific flags indicating scam indicators or safety landmarks." },
              summary: { type: Type.STRING, description: "Clear 1-2 sentence analysis describing the security rating." },
              advice: { type: Type.STRING, description: "Useful action suggestion to keep both safer." },
            },
            required: ["score", "riskLevel", "flags", "summary", "advice"],
          },
          temperature: 0.2,
        },
      });

      if (response.text) {
        const result = JSON.parse(response.text.trim());
        if (typeof result.score === "number") {
          fraudRiskResult = {
            score: Math.min(100, Math.max(0, result.score)),
            riskLevel: ["Low", "Medium", "High"].includes(result.riskLevel) ? result.riskLevel : (result.score > 69 ? "High" : result.score > 30 ? "Medium" : "Low"),
            flags: Array.isArray(result.flags) ? result.flags : ["AI Flags Evaluated"],
            summary: result.summary || "Evaluation completed successfully via Gemini.",
            advice: result.advice || "Proceed with caution using standard delivery checks."
          };
        }
      }
    } catch (err: any) {
      console.error("Gemini Fraud Checker Error:", err);
      // fallback preserved
    }
  } else {
    // Basic rules-based fallback engine to keep it highly realistic even without APIs
    const lowercaseItem = itemName.toLowerCase();
    const lowercaseDesc = itemDescription.toLowerCase();
    const isLuxuryDevice = lowercaseItem.includes("iphone") || lowercaseItem.includes("macbook") || lowercaseItem.includes("laptop") || lowercaseItem.includes("samsung ultra");
    
    let score = 20;
    let riskLevel: "Low" | "Medium" | "High" = "Low";
    const flagsList: string[] = ["Calculated on-device rules engine active"];
    
    if (isLuxuryDevice && numericPrice < 100000) {
      score = 85;
      riskLevel = "High";
      flagsList.push("Unrealistically cheap luxury hardware", "Possible Facebook/Instagram ghost-vendor signature");
    } else if (lowercaseDesc.includes("no inspect") || lowercaseDesc.includes("pay before") || lowercaseDesc.includes("customs")) {
      score = 75;
      riskLevel = "High";
      flagsList.push("Restricted inspection terms", "Advance customs clearance demand patterns");
    } else if (numericPrice > 300000) {
      score = 35;
      riskLevel = "Medium";
      flagsList.push("High value transaction requiring caution");
    }

    let summaryText = `Safe escrow guidelines applied. No immediate critical warning triggers detected.`;
    let adviceText = `Verify invoice slips and shipping logistics matches the registered name.`;
    
    if (riskLevel === "High") {
      summaryText = `This transaction displays serious warning indicators representing highly discounted luxury assets or delivery terms typical of social media DMs scams.`;
      adviceText = `DO NOT pay any external shipping, booking, or reservation fee directly to the seller outside this TrustBridge escrow.`;
    } else if (riskLevel === "Medium") {
      summaryText = `Transactions above NGN 300k fall under monitored escrow brackets to enforce tracking confirmation requirements.`;
      adviceText = `Ask the seller to ship with trackable services and verify the seller name matches their OPay profile.`;
    }

    fraudRiskResult = {
      score,
      riskLevel,
      flags: flagsList,
      summary: summaryText,
      advice: adviceText
    };
  }

  const newTransaction: Transaction = {
    id: transactionId,
    sellerId: `seller_${sellerName.toLowerCase().replace(/\s+/g, "_")}`,
    sellerPhone,
    sellerName,
    buyerPhone,
    buyerName,
    itemName,
    itemDescription,
    price: numericPrice,
    status: "AWAITING_DEPOSIT",
    createdAt: new Date().toISOString(),
    paymentLink: "", // Will be formulated on get
    fraudRisk: fraudRiskResult
  };

  transactionsList.unshift(newTransaction);
  const baseUrl = getBaseUrl(req);
  res.json({
    ...newTransaction,
    paymentLink: `${baseUrl}/?trxId=${newTransaction.id}`
  });
});

// 4. Update status or manage transaction states
app.post("/api/transactions/:id/action", (req, res) => {
  const { action, raisedBy, reason } = req.body;
  const tIndex = transactionsList.findIndex(t => t.id === req.params.id);

  if (tIndex === -1) {
    return res.status(404).json({ error: "Transaction not found." });
  }

  const transaction = { ...transactionsList[tIndex] };

  switch (action) {
    case "deposit":
      if (transaction.status === "AWAITING_DEPOSIT") {
        transaction.status = "SECURED_IN_ESCROW";
      } else {
        return res.status(400).json({ error: "Invalid state transition for deposit." });
      }
      break;
      
    case "ship":
      if (transaction.status === "SECURED_IN_ESCROW") {
        transaction.status = "DELIVERED_AWAITING_CONFIRMATION";
      } else {
        return res.status(400).json({ error: "Invalid state transition for shipment." });
      }
      break;

    case "release":
      if (["SECURED_IN_ESCROW", "DELIVERED_AWAITING_CONFIRMATION", "DISPUTED"].includes(transaction.status)) {
        transaction.status = "RESOLVED_RELEASED";
        transaction.deliveryConfirmedAt = new Date().toISOString();
      } else {
        return res.status(400).json({ error: "Invalid state transition for releasing funds." });
      }
      break;

    case "refund":
      if (["SECURED_IN_ESCROW", "DELIVERED_AWAITING_CONFIRMATION", "DISPUTED"].includes(transaction.status)) {
        transaction.status = "RESOLVED_REFUNDED";
      } else {
        return res.status(400).json({ error: "Invalid state transition for refunding." });
      }
      break;

    case "dispute":
      if (["SECURED_IN_ESCROW", "DELIVERED_AWAITING_CONFIRMATION"].includes(transaction.status)) {
        transaction.status = "DISPUTED";
        transaction.dispute = {
          raisedBy: raisedBy || "buyer",
          reason: reason || "No description provided.",
          raisedAt: new Date().toISOString(),
          evidence: []
        };
      } else {
        return res.status(400).json({ error: "Invalid state transition for raising dispute." });
      }
      break;

    default:
      return res.status(400).json({ error: "Unknown action parameter." });
  }

  transactionsList[tIndex] = transaction;
  const baseUrl = getBaseUrl(req);
  res.json({
    ...transaction,
    paymentLink: `${baseUrl}/?trxId=${transaction.id}`
  });
});

// 5. Submit dispute evidence and run Gemini Resolution Referee
app.post("/api/transactions/:id/dispute/evidence", async (req, res) => {
  const { by, text, imageUrl } = req.body;
  
  if (!by || !text) {
    return res.status(400).json({ error: "Evidence author and statement text are required." });
  }

  const tIndex = transactionsList.findIndex(t => t.id === req.params.id);
  if (tIndex === -1) {
    return res.status(404).json({ error: "Transaction not found." });
  }

  const transaction = { ...transactionsList[tIndex] };
  if (!transaction.dispute) {
    return res.status(400).json({ error: "This transaction is not in a disputed state." });
  }

  // Add evidence item
  transaction.dispute.evidence.push({
    by,
    text,
    imageUrl,
    submittedAt: new Date().toISOString()
  });

  // Perform arbitrator update
  let resolutionResult = {
    summary: `Re-evaluating facts with the new statement submitted by the ${by}.`,
    recommendation: "SPLIT_FUNDS" as "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT_FUNDS",
    splitDetails: "50% Buyer / 50% Seller",
    explanationToBoth: `Both buyer and seller have provided contradictory reports. TrustBridge recommends holding an active arbitration call or opting to split the funds 50/50 to avoid total losses while OPay agents trace dispatch liability.`
  };

  const client = getGeminiClient();
  if (client) {
    try {
      const systemInstruction = `
        You are 'TrustBridge Referee', the advanced AI dispute clearing court of OPay Escrow.
        You act as an impartial referee analyzing formal sales disputes between Nigerian buyers and informal merchant traders.
        You take the dispute details, the item description, the buyer's claims, the seller's defenses, and all uploaded evidence logs.
        
        Write a fair, objective and clear resolution judgment in standard English with high-quality legal and merchant professionalism.
        Determine who is likely correct. If both present valid concerns (e.g., shipping transit damage), recommend a practical split or full payout.
        
        Your response must conform to JSON schema. The recommendation enum must be exactly 'RELEASE_TO_SELLER', 'REFUND_TO_BUYER', or 'SPLIT_FUNDS'.
      `;

      const userPrompt = `
        Disputed Escrow Case Study:
        Item: "${transaction.itemName}" (Price: NGN ${transaction.price.toLocaleString()})
        Initial Dispute Reason: "${transaction.dispute.reason}"
        
        Current Submitted Evidences:
        ${transaction.dispute.evidence.map((ev, index) => `
          Evidence #${index + 1} By [${ev.by.toUpperCase()}]:
          "${ev.text}" (Posted: ${ev.submittedAt})
        `).join("\n")}
        
        Evaluate the situation thoroughly. Generate the JSON output with 'summary', 'recommendation', 'splitDetails' (mandatory only for SPLIT_FUNDS), and 'explanationToBoth'.
      `;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "Professional summary of the newly evaluated evidence facts." },
              recommendation: { type: Type.STRING, description: "Must be 'RELEASE_TO_SELLER' or 'REFUND_TO_BUYER' or 'SPLIT_FUNDS'." },
              splitDetails: { type: Type.STRING, description: "If SPLIT_FUNDS, specify split e.g., '50% Buyer / 50% Seller'. Else leave empty." },
              explanationToBoth: { type: Type.STRING, description: "A detailed description advising what is fair, using constructive polite logic." },
            },
            required: ["summary", "recommendation", "explanationToBoth"],
          },
          temperature: 0.1,
        },
      });

      if (response.text) {
        const result = JSON.parse(response.text.trim());
        resolutionResult = {
          summary: result.summary || "Case evaluated under AI dispute regulations.",
          recommendation: ["RELEASE_TO_SELLER", "REFUND_TO_BUYER", "SPLIT_FUNDS"].includes(result.recommendation) ? result.recommendation : "SPLIT_FUNDS",
          splitDetails: result.splitDetails || (result.recommendation === "SPLIT_FUNDS" ? "50% Buyer / 50% Seller" : undefined),
          explanationToBoth: result.explanationToBoth || "Impartial verification of claims favors a collaborative completion."
        };
      }
    } catch (err) {
      console.error("Gemini dispute clearing error:", err);
      // Fallback
    }
  } else {
    // Intelligent offline-split mock engine
    const latestEv = transaction.dispute.evidence;
    const buyerTexts = latestEv.filter(e => e.by === "buyer").map(e => e.text.toLowerCase()).join(" ");
    const sellerTexts = latestEv.filter(e => e.by === "seller").map(e => e.text.toLowerCase()).join(" ");

    let recap = `Both parties are submitting logs. Buyer highlights hardware flickering and usage failure. Seller insists Alaba tests protect against claims.`;
    let decision: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT_FUNDS" = "SPLIT_FUNDS";
    let splitNote = "60% Refund / 40% Release";
    let explanationText = "Because courier logistics lack formal insurance evidence on record, we advise splitting the repair costs. Unboxing videos would clarify dispatch fault.";

    if (buyerTexts.includes("stolen") || buyerTexts.includes("brick") || buyerTexts.includes("fake item")) {
      recap = `Buyer declares the received parcel contains a fake item or placeholder.`;
      decision = "REFUND_TO_BUYER";
      splitNote = "";
      explanationText = `OPay merchant policy strictly prevents payment release when physical inspectable items arrive in completely fake or mismatched categories. Escalated for immediate refund.`;
    } else if (sellerTexts.includes("signature slip") || sellerTexts.includes("waybill") || sellerTexts.includes("waybill receipt")) {
      recap = `Seller has uploaded official logistics sign-off waybill and transit logs confirming perfect deliverable inspect completed beforehand.`;
      decision = "RELEASE_TO_SELLER";
      splitNote = "";
      explanationText = `Official log receipts confirm successful physical verification at Enugu transfer offices. Balance is cleared and released to StyleHub wallet.`;
    }

    resolutionResult = {
      summary: recap,
      recommendation: decision,
      splitDetails: decision === "SPLIT_FUNDS" ? splitNote : undefined,
      explanationToBoth: explanationText
    };
  }

  transaction.dispute.aiRecommendation = resolutionResult;
  transactionsList[tIndex] = transaction;

  const baseUrl = getBaseUrl(req);
  res.json({
    ...transaction,
    paymentLink: `${baseUrl}/?trxId=${transaction.id}`
  });
});

// Configure Vite integration for Express development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware loaded.");
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from dist/.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TrustBridge Full-Stack server is operational on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
