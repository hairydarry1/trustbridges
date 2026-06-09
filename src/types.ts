/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EscrowStatus =
  | "AWAITING_DEPOSIT"
  | "SECURED_IN_ESCROW"
  | "DELIVERED_AWAITING_CONFIRMATION"
  | "RESOLVED_RELEASED"
  | "RESOLVED_REFUNDED"
  | "DISPUTED";

export interface EvidenceItem {
  by: "buyer" | "seller";
  text: string;
  imageUrl?: string;
  submittedAt: string;
}

export interface DisputeDetails {
  raisedBy: "buyer" | "seller";
  reason: string;
  raisedAt: string;
  evidence: EvidenceItem[];
  aiRecommendation?: {
    summary: string;
    recommendation: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT_FUNDS";
    splitDetails?: string; // e.g., "70% Buyer / 30% Seller"
    explanationToBoth: string;
  };
}

export interface FraudRiskAnalysis {
  score: number; // 0 to 100
  riskLevel: "Low" | "Medium" | "High";
  flags: string[];
  summary: string;
  advice: string;
}

export interface Transaction {
  id: string;
  sellerId: string;
  sellerPhone: string;
  sellerName: string;
  buyerPhone: string;
  buyerName: string;
  itemName: string;
  itemDescription: string;
  price: number; // in NGN
  status: EscrowStatus;
  createdAt: string;
  paymentLink: string;
  fraudRisk: FraudRiskAnalysis;
  deliveryConfirmedAt?: string;
  dispute?: DisputeDetails;
}
