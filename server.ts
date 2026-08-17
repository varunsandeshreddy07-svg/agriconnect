import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy GoogleGenAI client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    geminiEnabled: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
  });
});

// AI Farming Assistant Chat Endpoint
app.post("/api/ai/advisor", async (req, res) => {
  try {
    const { message, history = [], context = {} } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ai = getGeminiClient();
    if (ai) {
      const systemInstruction = `You are "AgriConnect AI Advisor" (Kisan Mitra), an expert agricultural scientist, agronomist, and farm market consultant.
You provide clear, highly practical, actionable advice to Indian and global farmers and agricultural buyers.
Your domain expertise includes:
- Crop disease identification, pest management, bio-pesticides, and chemical treatments with dosage.
- Soil nutrition, NPK balance, compost, organic farming, biofertilizers.
- Weather adaptation, climate resilience, irrigation scheduling (drip/sprinkler).
- Government schemes (PM-KISAN, e-NAM, Soil Health Card, Crop Insurance / PMFBY, MSP guidelines).
- Harvest timing, post-harvest storage, grain quality grading, direct-to-buyer negotiation tips.
- Market price trends and mandi price optimization.

Format your responses with clear headings, bullet points, and highlight critical warnings (e.g. pesticide safety precautions, withdrawal periods).
Keep language friendly, empathetic, respectful, and easy to understand.`;

      // Build conversation contents
      const conversationContents = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history.slice(-6)) {
          conversationContents.push({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.text || item.content || "" }],
          });
        }
      }
      conversationContents.push({
        role: "user",
        parts: [{ text: `${context?.cropContext ? `[Context: User is working with ${context.cropContext} in ${context.region || 'India'}] ` : ''}${message}` }],
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: conversationContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      return res.json({
        reply: response.text || "I have analyzed your query. Please maintain proper soil aeration and check moisture levels before applying any amendments.",
        source: "gemini-3.7-flash",
      });
    }

    // High quality intelligent fallback if API key is not configured
    const lower = message.toLowerCase();
    let fallbackReply = "";

    if (lower.includes("pest") || lower.includes("insect") || lower.includes("leaf") || lower.includes("disease") || lower.includes("rot")) {
      fallbackReply = `### 🌿 AgriConnect Pest & Disease Management Advisory

**1. Immediate Diagnosis Steps:**
- Inspect the underside of leaves for aphids, whiteflies, or fungal spores.
- Check soil moisture around root zones to rule out root rot or waterlogging.

**2. Organic & Bio-Control Measures:**
- **Neem Oil Spray (1500 ppm):** Mix 5ml Neem oil + 2ml liquid soap per liter of water. Spray during early morning or late evening.
- **Trichoderma viride:** Apply 2.5 kg/acre mixed with well-decomposed FYM (Farm Yard Manure) for soil-borne fungal pathogens.

**3. Integrated Chemical Control (If Severe):**
- For sucking pests: Imidacloprid 17.8% SL @ 0.5 ml/liter or Acetamiprid 20% SP @ 0.5 g/liter.
- For fungal blight/mildew: Mancozeb 75% WP @ 2.5 g/liter or Azoxystrobin @ 1 ml/liter.

⚠️ *Safety Precaution:* Observe a 7-10 day waiting period before harvest after chemical sprays.`;
    } else if (lower.includes("price") || lower.includes("mandi") || lower.includes("market") || lower.includes("sell") || lower.includes("rate")) {
      fallbackReply = `### 📈 AgriConnect Market Intelligence & Price Strategy

**1. Current Market Outlook:**
- Grade-A clean produce is attracting a **12–18% premium** over standard APMC mandi rates when sold directly via AgriConnect.
- Avoid distress selling immediately post-harvest if dry storage or warehouse receipt financing is accessible.

**2. Direct-to-Buyer Negotiation Checklist:**
- Offer batch moisture testing reports (<12% for grains, crisp quality for vegetables).
- Bundle transport or offer ex-farm gate loading options to attract wholesale buyers.
- Lock minimum order quantities (MOQ) with a 20% advance token via escrow or verified bank transfer.`;
    } else if (lower.includes("fertilizer") || lower.includes("npk") || lower.includes("soil") || lower.includes("urea") || lower.includes("dap")) {
      fallbackReply = `### 🧪 Balanced Fertilizer & Soil Health Schedule

**1. Basal Application (At Sowing/Transplanting):**
- Full dose of Single Super Phosphate (SSP) or DAP (Phosphorus for root establishment) + 50% Potash (MOP) + 25% Nitrogen.
- Incorporate 5 tons of well-rotted Farm Yard Manure (FYM) or Vermicompost per acre.

**2. Vegetative Stage (25-35 Days After Sowing):**
- Top-dress with Urea (split application) along with Micronutrient Zinc Sulfate (21% @ 10 kg/acre).
- Foliar spray of 19:19:19 water-soluble NPK @ 5g/liter.

**3. Flowering & Grain/Fruit Filling Stage:**
- Spray 0:52:34 (Monopotassium Phosphate) @ 5g/liter for uniform grain weight, luster, and disease resistance.
- Avoid excess Urea at flowering stage to prevent vegetative lodging.`;
    } else {
      fallbackReply = `### 🌱 AgriConnect Smart Farming Advice

Thank you for your question. Here is the recommended agricultural protocol:

1. **Soil & Irrigation Care:** Ensure well-drained bed preparation with adequate organic carbon. For high efficiency, adopt drip irrigation with fertigation valves.
2. **Crop Lifecycle Monitoring:** Check for uniform germination within 5–7 days. Implement yellow sticky traps (10 traps/acre) for early pest monitoring.
3. **AgriConnect Market Connect:** List your expected harvest 14 days in advance on the AgriConnect marketplace to secure forward contracts with bulk buyers at top rates.

*Feel free to specify your crop name, stage of growth, or upload symptoms for tailored recommendations!*`;
    }

    return res.json({
      reply: fallbackReply,
      source: "agriconnect-expert-engine",
    });
  } catch (error: any) {
    console.error("Advisor error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI farming advice" });
  }
});

// Comprehensive Farming & Trading Plan Generator
app.post("/api/ai/plan", async (req, res) => {
  try {
    const { crop, landSize, unit = "acres", soilType, irrigation, season, budget, location, targetYield } = req.body;
    
    if (!crop || !landSize) {
      return res.status(400).json({ error: "Crop name and land size are required" });
    }

    const ai = getGeminiClient();
    if (ai) {
      const prompt = `You are a precision agriculture and agritrade planning specialist.
Generate a comprehensive, practical, end-to-end "AgriConnect Farm & Trading Blueprint" for:
- Crop: ${crop}
- Land Area: ${landSize} ${unit}
- Soil Type: ${soilType || "Alluvial / Loam"}
- Irrigation Method: ${irrigation || "Borewell + Drip Irrigation"}
- Crop Season: ${season || "Rabi / Kharif"}
- Budget Allocation: ${budget ? `₹${budget}` : "Standard optimal commercial budget"}
- Agro-Climatic Region: ${location || "Semi-arid / Indo-Gangetic Plains"}
${targetYield ? `- Target Yield: ${targetYield}` : ""}

Provide the output formatted as clear, professional Markdown with these specific sections:
1. 📋 **Executive Summary & Land Economics** (Estimated Yield, Total Budget Required, Gross Revenue Projection, Net Profit Margin)
2. 🗓️ **Week-by-Week Cultivation Roadmap** (From Land Prep to Sowing, Vegetative, Flowering, and Harvest)
3. 💧 **Nutrition & Water Management Matrix** (Basal, Top-dressing, Micronutrients, Drip schedule)
4. 🛡️ **Pest & Weather Risk Mitigation** (Common threats, Organic prevention, Chemical backup, Heavy rain/Drought mitigation)
5. 📊 **Cost Breakdown Sheet** (Seeds, Fertilizers, Labor, Machinery, Packaging, Logistics)
6. 🤝 **AgriConnect Post-Harvest Trading & Monetization Strategy** (Mandi vs Direct Marketplace buyers, Quality grading specs to maximize price, Sample packaging, Storage shelf-life extensions)

Ensure specific numbers, realistic metric quantities (kg/acre, liters, price per quintal), and realistic rupee figures suitable for an Indian/global agricultural college project showcase.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          temperature: 0.6,
        },
      });

      return res.json({
        plan: response.text,
        source: "gemini-3.7-flash",
      });
    }

    // Dynamic High-Quality Fallback Plan
    const sizeNum = parseFloat(landSize) || 1;
    const estYieldPerAcre = crop.toLowerCase().includes("wheat") ? 18 : crop.toLowerCase().includes("rice") || crop.toLowerCase().includes("paddy") ? 22 : crop.toLowerCase().includes("tomato") ? 150 : 25;
    const totalYieldQuintals = Math.round(estYieldPerAcre * sizeNum);
    const estRatePerQuintal = crop.toLowerCase().includes("wheat") ? 2450 : crop.toLowerCase().includes("rice") ? 2800 : crop.toLowerCase().includes("tomato") ? 1800 : 3200;
    const estRevenue = totalYieldQuintals * estRatePerQuintal;
    const estCostPerAcre = 22000;
    const totalCost = Math.round(estCostPerAcre * sizeNum);
    const netProfit = estRevenue - totalCost;

    const fallbackPlan = `# 🌾 AgriConnect Farm & Trading Blueprint: ${crop.toUpperCase()} (${landSize} ${unit})

## 1. 📋 Executive Summary & Land Economics
* **Agro-Climatic Setting:** ${location || "Standard Regional Farm Belt"} | **Soil:** ${soilType || "Alluvial / Sandy Loam"} | **Irrigation:** ${irrigation || "Borewell + Drip"}
* **Estimated Total Harvest Yield:** **${totalYieldQuintals} Quintals** (~${(totalYieldQuintals * 100).toLocaleString()} kg)
* **Estimated Input Cost:** **₹${totalCost.toLocaleString()}** (Avg. ₹${estCostPerAcre.toLocaleString()}/${unit})
* **Projected Gross Revenue:** **₹${estRevenue.toLocaleString()}** (@ ₹${estRatePerQuintal.toLocaleString()}/quintal)
* **Estimated Net Profit:** **₹${netProfit.toLocaleString()}** (ROI: **${Math.round((netProfit / totalCost) * 100)}%**)

---

## 2. 🗓️ Week-by-Week Cultivation Roadmap
* **Week 1–2 (Land Preparation & Basal Feeding):**
  - Deep ploughing followed by 2 passes of rotavator to achieve fine tilth.
  - Apply 4–5 tonnes of FYM per acre + Single Super Phosphate (SSP) 100 kg/acre.
  - Treat seeds with *Trichoderma viride* (10g/kg seed) to prevent seed-borne wilt.
* **Week 3–4 (Sowing / Seedling Establishment):**
  - Maintain optimal row-to-row spacing (20–22.5 cm) and depth (3–4 cm).
  - First light irrigation immediately after sowing; confirm 90%+ germination rate.
* **Week 5–8 (Vegetative Growth & Tillering):**
  - First weeding/hoeing at 21 days; apply first top dressing of Urea (35 kg/acre).
  - Foliar spray of Zinc Sulphate (0.5%) + Ferrous Sulphate (0.2%) for lush chlorophyll formation.
* **Week 9–13 (Flowering, Heading & Pod/Grain Development):**
  - Crucial moisture-sensitive stage: ensure unhindered drip/furrow irrigation.
  - Spray NPK 00:52:34 @ 5g/liter to accelerate grain bolding and uniform coloring.
* **Week 14–16 (Maturity & Harvest Operations):**
  - Cease irrigation 10–12 days before scheduled combine/manual harvesting.
  - Harvest when crop moisture drops to 14–16%; dry under shade to optimal 12% moisture.

---

## 3. 💧 Precision Nutrition & Irrigation Matrix
| Growth Stage | Irrigation Interval | Primary Nutrient / Foliar Application |
| :--- | :--- | :--- |
| Seedling (0–20 DAT) | Every 4–5 days | Basal DAP 50kg + MOP 25kg + FYM |
| Tillering (21–45 DAT) | Every 6–7 days | Urea 35kg/acre + Micronutrient blend |
| Panicle / Flowering | Every 4 days | 19:19:19 (Foliar 5g/L) + Boron (1g/L) |
| Grain Filling | Every 5–6 days | Potassium Nitrate (13:00:45 @ 5g/L) |

---

## 4. 🛡️ Pest & Weather Risk Management
* **Biological Control:** Install 8–10 Pheromone traps and 12 Yellow sticky cards per acre.
* **Fungal Blight / Rust Shield:** Prophylactic spray of Mancozeb 75% WP (2.5g/L) before cloudy overcast weather.
* **Weather Hedging:** AgriConnect weather radar alerts warn 72h prior to unseasonal rains for timely tarp protection.

---

## 5. 📊 Cost Breakdown
* **Field Preparation & Machinery:** ₹${Math.round(totalCost * 0.18).toLocaleString()} (18%)
* **Certified Seeds & Seed Treatment:** ₹${Math.round(totalCost * 0.14).toLocaleString()} (14%)
* **Fertilizers, Bio-nutrients & Organics:** ₹${Math.round(totalCost * 0.28).toLocaleString()} (28%)
* **Labor & Weeding Management:** ₹${Math.round(totalCost * 0.22).toLocaleString()} (22%)
* **Harvesting, Bagging & Farm-gate Logistics:** ₹${Math.round(totalCost * 0.18).toLocaleString()} (18%)

---

## 6. 🤝 AgriConnect Post-Harvest Trading Strategy
1. **Pre-Harvest Listing:** List your ${crop} crop on AgriConnect 14 days before harvest to receive verified buyer bids.
2. **Quality Grading:** Label your crop as **Grade A+ (Moisture <12%, Foreign Matter <0.5%)** to capture top ₹${estRatePerQuintal + 150}/qtl offers.
3. **Logistics Optimization:** Group shipments with neighboring AgriConnect farmers to reduce freight cost by up to 25%.`;

    return res.json({
      plan: fallbackPlan,
      source: "agriconnect-expert-engine",
    });
  } catch (error: any) {
    console.error("Plan generator error:", error);
    res.status(500).json({ error: error.message || "Failed to generate agricultural plan" });
  }
});

// Price Estimator & Mandi Comparison Endpoint
app.post("/api/ai/price-estimate", async (req, res) => {
  try {
    const { crop, variety, grade = "Grade A", location } = req.body;
    const ai = getGeminiClient();

    if (ai && crop) {
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: `You are an Indian and global agricultural commodity price analyst.
Give a concise price estimation for:
- Crop: ${crop}
- Variety: ${variety || "Standard"}
- Grade: ${grade}
- Region: ${location || "India / National Average"}

Return valid JSON with these keys:
{
  "minMandiPrice": number,
  "maxMandiPrice": number,
  "avgMandiPrice": number,
  "recommendedDirectPrice": number,
  "marketTrend": "bullish" | "bearish" | "stable",
  "trendPercentage": "+5.2%",
  "mspRate": number,
  "analysis": "2 sentence summary of market dynamics",
  "tradingTip": "1 actionable advice for the farmer or buyer"
}`,
        config: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      });

      try {
        const parsed = JSON.parse(response.text || "{}");
        return res.json({ data: parsed, source: "gemini-3.7-flash" });
      } catch {
        // pass through to fallback
      }
    }

    // Baseline fallback rates
    const cropLower = (crop || "").toLowerCase();
    let base = 2500;
    let msp = 2275;
    if (cropLower.includes("wheat")) { base = 2450; msp = 2275; }
    else if (cropLower.includes("rice") || cropLower.includes("paddy")) { base = 2900; msp = 2300; }
    else if (cropLower.includes("tomato")) { base = 1800; msp = 1400; }
    else if (cropLower.includes("cotton")) { base = 7100; msp = 6620; }
    else if (cropLower.includes("soybean")) { base = 4800; msp = 4600; }
    else if (cropLower.includes("onion")) { base = 2100; msp = 1500; }
    else if (cropLower.includes("turmeric")) { base = 12500; msp = 9500; }

    return res.json({
      data: {
        minMandiPrice: Math.round(base * 0.92),
        maxMandiPrice: Math.round(base * 1.08),
        avgMandiPrice: base,
        recommendedDirectPrice: Math.round(base * 1.12),
        marketTrend: "bullish",
        trendPercentage: "+6.4%",
        mspRate: msp,
        analysis: `Demand for clean ${grade} ${crop || "produce"} remains firm across regional hubs due to high consumer absorption and steady processor procurement.`,
        tradingTip: `Direct sale to food processors on AgriConnect fetches ~12% above local APMC mandi yard prices due to zero middleman cuts.`,
      },
      source: "agriconnect-expert-engine",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to estimate price" });
  }
});

// Vite Middleware for development vs Static serving for production
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌾 AgriConnect Server running on http://localhost:${PORT}`);
  });
}

start();
