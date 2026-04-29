export interface NewsItem {
    id: string;
    headline: string;
    generated_news: string;
    sentiment_score: number;
}

export const DEFAULT_SYSTEM_PROMPT = `#**Role:**
You are a **Cinematic Visual Artist & Brand Strategist**. Your task is to analyze raw market news and create a cinematic image prompt using the **Master Prompt Formula**.

#**Objective:**
Bypass dry news visuals and create a high-alpha, futuristic image that represents VibeTrader's "Control & Alpha" branding.

#**VibeTrader Branding Guide:**
- Colors: Neon Purple (#A855F7), Electric Pink (#EC4899), Dark Mode UI.
- Visual Vibe: Futuristic Holographic Dashboards, Sleek UI, Confident Traders, Glowing Neural Networks.

#**Instructions:**
##**Instruction 1 : The Strategic Bridge**
Instead of just visualizing the news headline (e.g., "AMD Shares"), bridge it to a VibeTrader trader's experience. 
- If sentiment is positive (>0.3): Focus on "Winning/Growth/Alpha".
- If sentiment is negative (<-0.3): Focus on "Control/Security/Risk-Free".

##**Instruction 2 : Visual Construction**
Create a prompt using this exact formula:
\`[Emotional tone/moods] + meets + [Visual film/game references] + of + [Subject/Scene details] + [Composition] + [Lighting] + [Camera settings]\`

##**Instruction 3 : Dual Format**
Output exactly:
### Master Structured Prompt
\`[Tone] + meets + [Reference] + of + [Subject]...\`

### Clean Copy-Paste Prompt
\`\`\`
[The fully generated prompt text without any brackets]
\`\`\`

#**Notes:**
- **Logo**: VibeTrader logo on glass sidebar.
- **Style**: Blade Runner 2049 meets Cyberpunk 2077.`;

export const DEFAULT_USER_TEMPLATE = `Target News: {headline}
Summary: {summary}
Sentiment: {sentiment}
Generate the cinematic visual prompt now.`;

export const STATS_SYSTEM_PROMPT = `# ROLE

You are a **Financial News Carousel Card Designer** — you create premium dark-mode social media carousel slide image prompts styled like Instagram/LinkedIn finance pages (think Morning Brew, The Hustle, Bloomberg Markets on Instagram).

Your output is a single image prompt for ONE carousel slide card that shows:
- The news headline
- 3 to 5 key statistics or data points extracted from the news
- A brief 1-2 sentence summary
- Sentiment indicator (Bullish / Bearish / Neutral)
- Market impact badge
- Carousel slide indicators (dots) at the bottom

---

# CAROUSEL SLIDE DESIGN STYLE

Format: Square 1:1 ratio (Instagram/LinkedIn carousel style)

Visual structure:
- Thick colored left border stripe (accent color based on sentiment)
- Top-left: small brand tag "VibeTrader Markets" in muted text
- Top-right: slide number indicator like "2 / 5" in small muted text
- Bold headline centered or left-aligned in large white text
- Stats section: 3-5 big number blocks in a clean row or 2x2 grid
  - Each stat: large bold number in accent color + tiny label below in muted white
- Divider line separating stats from summary
- Summary: 1-2 lines of small clean white text
- Bottom row: sentiment chip (Bullish / Bearish / Neutral) + market impact badge + pagination dots
- Background: deep navy #0a0f1e or rich dark #0d1117
- Subtle noise/grain texture overlay for premium feel
- Rounded corners on the card

Accent color rules:
- Bullish (sentiment > 0.3): electric green #00ff88 or cyan #00d4ff
- Bearish (sentiment < -0.3): hot red #ff4444 or amber #ff9500
- Neutral: steel blue #4a90d9 or gray #8899aa

Typography:
- Headline: bold, large, premium sans-serif (Inter, SF Pro style)
- Stats numbers: extra bold, accent color
- Labels and summary: small, muted white, light weight
- Tags: tiny, monospace or uppercase tracking

---

# STATS EXTRACTION RULES

From the news summary, extract ONLY real numbers mentioned:
- Prices (oil at $99.20, gold at $2,340)
- Percentages (up 2.4%, fell 0.9%)
- Index levels (S&P 500 at 5,200)
- Rate figures (interest rate at 3.5%)
- Deal values ($34 billion acquisition)

If fewer than 3 stats found, use sentiment score and market impact as additional data points.

---

# OUTPUT FORMAT

## STATS EXTRACTED
[List 3-5 key stats from the news]

## FINAL IMAGE PROMPT

Create a premium dark-mode social media carousel slide card image for a financial news post.

Layout:
- Dark navy/black square background with subtle grain texture
- Thick left-side vertical accent stripe in [color based on sentiment]
- Top-left corner: tiny "VibeTrader Markets" brand label in muted gray
- Top-right corner: slide indicator "2 / 5" in small muted text
- Bold headline in large white text: [4-6 word headline]
- Stats grid below headline: [3-5 stat blocks] each showing large bold number in accent color with small muted label underneath
- Thin horizontal divider line
- Summary text in small clean white: [1-2 sentence summary]
- Bottom row: sentiment badge chip + market impact label + 5 pagination dots (second dot highlighted)
- Rounded card corners, slight drop shadow

Headline: [extracted 4-6 word headline]
Stats: [list the stats]
Summary: [1-2 sentence plain summary]
Sentiment: [Bullish/Bearish/Neutral]
Market Impact: [High/Medium/Low]

Style: Instagram Finance Carousel x Bloomberg Terminal x Morning Brew dark card
Negative prompt: charts, graphs, candlesticks, photos, people, buildings, bright background, clutter, excessive decoration`;

export const STATS_USER_TEMPLATE = `News Headline: {headline}
Summary: {summary}
Sentiment Score: {sentiment}
Generate the carousel stats card image prompt now.`;

export const STATIC_NEWS: NewsItem[] = [
    {
        id: "1",
        headline: "Gold and Silver Surge Amid Stalled U.S.-Iran Peace Talks and Persistent Geopolitical Risks",
        generated_news: "The start of the week saw precious metals, particularly gold (XAU/USD) and silver (XAG/USD), rallying as geopolitical tensions between the U.S. and Iran intensified and peace talks stalled. Gold attracted dip-buyers and surged over $50 from the Asian session low, around the $4,672 region, buoyed by reports that Iran offered the U.S. a new proposal to reopen the Strait of Hormuz and end the war, while nuclear negotiations were postponed for a later stage [1][3]. This revived hopes for peace but simultaneously undermined the U.S. Dollar's reserve currency status, supporting gold prices [1]. Silver also gained for the second consecutive day, trading near $76.00 per troy ounce, driven by increased safe-haven demand amid the stalled negotiations [2].\n\nU.S. President Donald Trump canceled plans to send envoys Steve Witkoff and Jared Kushner to Islamabad for talks, citing confusion within Tehran's leadership. Trump stated, \"If they want to talk, they can come to us, or they can call us. You know, there is a telephone. We have nice, secure lines\" [2][3][4]. Iranian President Masoud Pezeshkian and Foreign Ministry spokesman Esmaeil Baqaei both indicated reluctance to enter negotiations under threats or blockade, and confirmed no meetings were planned [2][4]. Traffic through the Strait of Hormuz remains largely blocked due to Iranian restrictions and a U.S. naval blockade, sustaining elevated crude oil prices and persistent inflationary concerns [1][2][3]. Brent oil futures rose around 1% to $106.55 per barrel, while U.S. crude oil added 0.88% to $95.23 per barrel [3]. Goldman Sachs raised its Brent forecast to $90 a barrel by late 2026, citing ongoing disruptions and record inventory draws of 11-12 million barrels per day in April [3].\n\nDespite these tensions, global equities have shown resilience, recouping losses from the initial outbreak of the war and hovering near record highs. Analysts attribute this to a balance between geopolitical risks and strong structural drivers, such as artificial intelligence [3]. European markets are expected to open broadly higher, with Germany's DAX up 0.3%, France's CAC 40 up 0.2%, and Italy's FTSE MIB up 0.26% [4]. Market attention is also focused on upcoming central bank meetings, including the U.S. Federal Reserve, ECB, and BOE, as the war continues to impact inflation and growth expectations [4]. The Fed is expected to keep rates unchanged at its April meeting, with gradual rate cuts anticipated under incoming Chair Kevin Warsh [2][4].\n\nPhysical demand for gold remains robust, with premiums in India climbing to their highest in over two-and-a-half months and Chinese bullion trading at premiums of $9 to $12 an ounce, up from $3 to $6 the previous week [1]. This renewed physical demand and fresh buying interest further support bullish sentiment for gold. Technical analysis suggests gold remains confined in a monthly range, consolidating after rebounding from the 200-day SMA, indicating the broader uptrend remains intact despite cooling momentum [1].\n\nForward-looking statements from analysts and banks highlight expectations for sustained tightness in energy markets and persistent inflationary pressures. Goldman Sachs and Invesco both anticipate elevated oil prices absent a full normalization of flows through Hormuz [3]. Central banks are expected to maintain current rates but may leave the door open for hikes later in the year, depending on inflation developments [4].\n\n### CONCLUSION\nGold and silver prices have surged as geopolitical risks and stalled U.S.-Iran peace talks drive safe-haven demand and support elevated energy prices. Despite these tensions, global equities remain resilient, and central banks are expected to maintain current policy stances while monitoring inflation. The ongoing disruptions in the Strait of Hormuz and robust physical demand for precious metals suggest continued volatility and upside potential in commodity markets.",
        sentiment_score: 0.3
    },
    {
        id: "2",
        headline: "Euro Strengthens Against Major Currencies as Technical Support Holds for EUR/JPY and EUR/USD",
        generated_news: "The Euro demonstrated resilience against major currencies during Asian trading on Monday, with both EUR/JPY and EUR/USD pairs showing constructive technical setups and holding above key support levels. EUR/JPY traded around 186.70 after modest gains the previous day, consolidating above both the nine-day and 50-day Exponential Moving Averages (EMAs), which signals a bullish near-term bias. The 14-day Relative Strength Index (RSI) for EUR/JPY was around 60, indicating positive momentum without being overbought. The pair remains just below its all-time high of 187.95, recorded on April 17, with potential to advance toward the upper boundary of the ascending channel near 189.70 if bullish momentum continues. Immediate support is seen at the nine-day EMA of 186.75 and the lower channel boundary at 186.60, with a break below these levels potentially targeting the 50-day EMA at 184.94 [1].\n\nThe Euro was the strongest against the US Dollar among major currencies, with a 0.06% gain, while EUR/JPY also showed a 0.03% increase. The heat map provided further details on percentage changes among major currency pairs, highlighting the Euro's relative strength in the session [1].\n\nFor EUR/USD, the pair rebounded to trade near 1.1730, recovering early losses as the US Dollar Index (DXY) fell 0.06% to around 98.45. The DXY had opened higher at 99.35, influenced by geopolitical developments, including the US canceling a visit to Islamabad for peace talks with Iran and Iran's proposal to reopen the Strait of Hormuz and end the war, as reported by Bloomberg. These events contributed to volatility in the currency markets [2].\n\nTechnical analysis for EUR/USD shows the pair trading above the 20-day EMA at 1.1696, maintaining a constructive bias. The RSI at 54.9 suggests firm but not overstretched bullish momentum. Immediate resistance is at the 50.0% Fibonacci retracement at 1.1749, with further targets at 1.1828 and 1.1941 if the rally continues. On the downside, support is seen at the 20-day EMA and the 38.2% Fibonacci level at 1.1670, with deeper support at 1.1572 and 1.1413. Investors are preparing for heightened volatility this week as both the Federal Reserve and the European Central Bank are set to announce monetary policy decisions on Wednesday and Thursday, respectively [2].\n\n### CONCLUSION\nBoth EUR/JPY and EUR/USD are holding above key technical support levels, reflecting the Euro's relative strength in the current market environment. With major central bank policy announcements scheduled this week, investors anticipate increased volatility, but the technical outlook for the Euro remains constructive in the near term.",
        sentiment_score: 0.3
    },
    {
        id: "3",
        headline: "Daikin Shares Rise as Elliott Pushes for Cost Cuts and Higher Returns",
        generated_news: "Shares of Daikin Industries edged up on Monday after activist investor Elliott outlined a plan aimed at boosting returns at the world's largest air-conditioner maker [1]. Elliott's proposal, which references unnamed former Daikin executives, argues that the company still has room to improve profit margins and has not yet maximized its profitability, despite its leading industry position [1]. The activist investor asserts that Daikin could double its Return on Equity (ROE) within five years by implementing cost cuts and operational improvements, which are expected to significantly increase shareholder value [1].\n\nMarket sentiment was described as cautiously optimistic, with Daikin's share price firming in response to the news. Investors are reacting positively to the prospect of enhanced returns and greater capital efficiency, as reflected in technical analysis indicating a firming trend and increased volatility in Daikin's shares [1]. Market participants are closely monitoring Daikin's price levels for signs of sustained momentum, with the potential for further upside if management adopts the proposed reforms [1].\n\nElliott's plan includes recommendations for operational improvements and cost reductions, and cites unnamed former Daikin executives who believe there is still room to improve profit margins [1]. The activist's assertion that Daikin could double ROE within five years is a key point of focus for investors and analysts [1].\n\n### CONCLUSION\nElliott's activist proposal has sparked cautious optimism among investors, leading to a modest rise in Daikin's share price. The market is closely watching for management's response to the suggested reforms, which could drive further upside if implemented.",
        sentiment_score: 0.4
    },
    {
        id: "4",
        headline: "Markets Brace for Volatility as Five Central Banks Announce Decisions Amid Geopolitical Tensions",
        generated_news: "During the week of April 28 to May 2, markets are preparing for a highly eventful period, described as the most institutionally dense calendar of the quarter, with five major central banks scheduled to announce policy decisions over three consecutive days. The Bank of Japan will announce its decision on Tuesday, followed by the Federal Reserve and Bank of Canada on Wednesday, and the European Central Bank and Bank of England on Thursday. This cluster of central bank activity is expected to create significant volatility, particularly on Tuesday and Wednesday due to potential shifts in rate differentials, and again on Thursday with the synchronized announcements from the ECB and BOE. The week concludes with the release of the ISM Manufacturing data on Friday, adding another potential market-moving event [1].\n\nIn addition to central bank decisions, the U.S. Senate Banking Committee is set to vote on Kevin Warsh's nomination for Federal Reserve chair on Tuesday. Key U.S. economic data, including Q1 GDP and PCE inflation, will be released on Thursday, further contributing to the week's risk profile [1].\n\nGeopolitical developments are also influencing market sentiment. Former President Trump cancelled his envoys' weekend trip to Pakistan, while Iran's foreign minister stated that negotiations are off-limits under 'threats or blockade.' Both sides are maintaining the blockade of the Strait of Hormuz, adding to global uncertainty [1].\n\nThe combination of central bank decisions, critical economic data releases, and heightened geopolitical tensions is expected to create multiple windows of volatility throughout the week, with market participants closely monitoring developments for potential impacts on global financial markets [1].\n\n### CONCLUSION\nThe convergence of major central bank decisions, key U.S. economic data, and escalating geopolitical tensions is setting the stage for a highly volatile week in global markets. Investors are advised to remain vigilant as multiple risk events could drive significant market movements.",
        sentiment_score: 0.0
    },
    {
        id: "5",
        headline: "Vietnam's Masan High-Tech Materials Soars as Tungsten Prices Hit Record Highs Amid Chinese Export Curbs",
        generated_news: "Vietnamese mining company Masan High-Tech Materials is experiencing a significant financial upswing following a dramatic surge in tungsten prices, a development attributed to China's recent export controls on the rare metal. Tungsten, essential for industrial cutting tools, military hardware, and artificial intelligence applications, has seen its price increase nearly ninefold due to tight supply outside China and soaring demand, particularly from the AI sector [1].\n\nMasan High-Tech Materials' Nui Phao tungsten mine in Thai Nguyen province is at the forefront of this boom. The company projects its net profit will surge 150 times this year, a direct result of the elevated tungsten prices and constrained global supply [1]. Financial analysts describe the current market sentiment around tungsten as extremely bullish, positioning Masan High-Tech Materials as a major beneficiary of these market dynamics [1].\n\nTechnical analysis cited in the article indicates strong upward momentum for tungsten prices, with resistance levels being consistently broken as buyers enter the market amid ongoing supply concerns [1]. Company officials expressed optimism, stating, \"Our time is now,\" and emphasized their expectation to capture significant market share as long as current conditions persist [1].\n\nMarket observers and traders are closely monitoring potential changes in Chinese export policy and fluctuations in demand from high-tech and military sectors, as these factors could impact price stability and future profitability for producers like Masan High-Tech Materials. The company is expected to remain a focal point for investors as long as supply remains tight and prices elevated [1].\n\n### CONCLUSION\nMasan High-Tech Materials is poised for a record year, driven by unprecedented tungsten price increases following Chinese export restrictions. With bullish market sentiment and strong profit projections, the company stands out as a key beneficiary in the current commodities landscape. Investors are advised to monitor policy and demand shifts that could affect future market dynamics.",
        sentiment_score: 0.9
    },
    {
        id: "6",
        headline: "Japan's Nikkei Surges Past 60,000, Poised for Record Close Amid Tech Rally",
        generated_news: "On April 27, 2026, Japan's benchmark Nikkei Stock Average surpassed the 60,000 mark, positioning itself for a record closing high as investors poured capital into technology stocks [1]. During the morning session, the Nikkei rose by approximately 900 points, reflecting strong market enthusiasm and momentum in the tech sector [1].\n\nThe rally was not limited to Japan; South Korean stocks also experienced significant gains as funds flowed into technology shares, indicating a broader regional appetite for tech investments [1]. The article highlights the robust investor sentiment driving the surge, particularly in technology-related equities, but does not specify individual company names or ticker symbols [1].\n\nNo forward-looking statements or analyst opinions are provided in the source, nor are there additional details regarding the exact closing level, specific market reactions, or projections for future performance [1].\n\n### CONCLUSION\nJapan's Nikkei Stock Average broke through the 60,000 level, fueled by strong investor interest in technology stocks and setting the stage for a potential record close. The rally extended to South Korean markets, underscoring a regional tech-driven surge. Market sentiment appears highly positive, with significant capital inflows into the sector.",
        sentiment_score: 0.9
    },
    {
        id: "7",
        headline: "Sun Pharma to Acquire Organon in $11.75 Billion All-Cash Deal, Expanding Global Reach",
        generated_news: "Sun Pharmaceutical Industries, India's largest drugmaker, announced it will acquire New Jersey-based Organon & Co in an all-cash transaction valued at $11.75 billion, including debt [1]. Under the terms of the deal, Sun Pharma will purchase all outstanding shares of Organon for $14.00 per share [1]. This acquisition is set to boost Sun Pharma's revenues to $12.4 billion, positioning the company among the top 25 global pharmaceutical firms [1].\n\nOrganon, which was spun off from Merck in 2021, specializes in women's health and biosimilars, offering more than 70 products across 140 countries [1]. Organon's key markets include the U.S., Europe, China, Canada, and Brazil, supported by six manufacturing facilities in the European Union and emerging markets [1]. Carrie Cox, executive chair at Organon, stated that the all-cash transaction offers 'compelling and immediate value to Organon stockholders' following a comprehensive review of strategic alternatives [1].\n\nSun Pharma's management emphasized that the acquisition is a strategic move to strengthen its global business and scale its medicine products, particularly in the U.S. market [1]. The deal aligns with Sun Pharma's strategy to grow its Innovative Medicines business, which currently covers dermatology, ophthalmology, and onco-dermatology [1]. In the financial year ending March 2025, Sun Pharma's innovative medicine segment accounted for 20% of total sales, but with the Organon acquisition, this segment is expected to contribute 27% to the company's topline [1].\n\nMarket reaction was notable: Organon shares surged nearly 31% on Friday after reports of the potential deal, while Sun Pharma's stock closed 3.6% lower [1].\n\n### CONCLUSION\nSun Pharma's $11.75 billion acquisition of Organon marks a significant expansion of its global footprint and product portfolio, particularly in innovative medicines. The deal is expected to enhance Sun Pharma's revenue and market position, though initial market reactions were mixed, with Organon shares rising sharply and Sun Pharma's stock declining. The transaction underscores Sun Pharma's commitment to scaling its presence in key international markets.",
        sentiment_score: 0.7
    },
    {
        id: "8",
        headline: "Iran Offers US Proposal to Reopen Strait of Hormuz, Impacting Dollar and Oil Markets",
        generated_news: "Iran has presented a new proposal to the United States aimed at reopening the Strait of Hormuz and ending ongoing conflict, with the plan including a postponement of nuclear negotiations until after the US blockade of the Strait is lifted [1][2]. The proposal, delivered via Pakistani mediators, calls for an extension of the ceasefire to allow both countries to work toward a permanent resolution [2]. However, US President Donald Trump instructed Jared Kushner and Steve Witkoff to skip a planned trip to Pakistan, stating that Iran 'offered a lot, but not enough,' and Iranian President Masoud Pezeshkian asserted that Iran would not enter 'imposed negotiations under threats or blockade' [1][3].\n\nThe US Dollar Index (DXY) declined below 98.50, trading near 98.45 during Asian trading hours on Monday, as hopes for a US-Iran ceasefire and easing tensions in the Middle East weighed on the dollar [1]. The USD/CAD pair remained subdued for the second consecutive day, trading around 1.3660, as the Canadian Dollar benefited from higher oil prices [3]. West Texas Intermediate (WTI) crude oil prices rose, trading at $93.70 per barrel with a 0.33% daily gain [2], and around $94.00 per barrel according to another source [3], following a previous 2.4% loss. The increase in oil prices was attributed to supply concerns amid stalled US-Iran peace talks and restricted traffic through the Strait of Hormuz due to Iran's controls and the US naval blockade [3].\n\nMarket reactions were notable, with WTI oil prices advancing on supply concerns and the US Dollar extending losses despite increased safe-haven demand as the ceasefire comes under strain, particularly with escalating attacks between Israel and Hezbollah despite a US-brokered extension intended to halt fighting for three weeks [3]. Deutsche Bank analysts noted that a repricing of Federal Reserve policy toward a more hawkish stance, driven by persistent oil-related inflation, could potentially boost the DXY [1]. The Federal Reserve is expected to keep the federal funds rate between 3.50% and 3.75% at its upcoming meeting on Wednesday [1].\n\n### CONCLUSION\nIran's proposal to reopen the Strait of Hormuz has triggered declines in the US Dollar and gains in oil prices, with the Canadian Dollar also benefiting from higher crude prices. Market sentiment remains cautious as negotiations are stalled and supply concerns persist, while upcoming Federal Reserve decisions and ongoing Middle East tensions continue to influence currency and commodity markets.",
        sentiment_score: 0.1
    },
    {
        id: "9",
        headline: "AUD/USD Climbs to Three-Day High as Bulls Eye Breakout on Softer US Dollar",
        generated_news: "The AUD/USD currency pair advanced for the second consecutive day, reaching a three-day high around the 0.7170 level during the Asian session, following a modest dip on Monday [1]. Despite ongoing US-Iran tensions and a standoff over the Strait of Hormuz, the US Dollar (USD) remained under pressure, with buyers hesitant ahead of the upcoming FOMC meeting this week [1]. A generally positive risk tone and the Reserve Bank of Australia's (RBA) hawkish stance provided additional support for the Australian Dollar (AUD) against the Greenback [1].\n\nFrom a technical perspective, the AUD/USD pair's recent range-bound movement is seen as a bullish consolidation phase, following a rally from the 100-day Simple Moving Average (SMA) touched in March [1]. Momentum indicators such as the Relative Strength Index (RSI) above 60 and a positive Moving Average Convergence Divergence (MACD) histogram suggest sustained upside pressure, with the path of least resistance remaining to the upside [1]. However, a decisive move above the 0.7185-0.7190 resistance area is required to confirm a bullish breakout [1].\n\nOn the downside, any corrective pullback is expected to find support ahead of the 0.7100 mark, with a break below this level potentially signaling a corrective phase within the broader bullish structure [1].\n\n### CONCLUSION\nThe AUD/USD pair's advance to a three-day high reflects ongoing bullish momentum, supported by a softer US Dollar and positive risk sentiment. Technical indicators point to further upside potential, though confirmation of a breakout awaits a move above the 0.7185-0.7190 range. Market participants remain cautious ahead of the FOMC meeting, but the AUD continues to show relative strength against major currencies.",
        sentiment_score: 0.4
    },
    {
        id: "10",
        headline: "China's Industrial Profits Surge 15.8% in March Despite Oil Price Shock from Middle East Conflict",
        generated_news: "China's industrial firms reported a significant profit increase in March, with profits rising 15.8% year-on-year, according to data from the National Bureau of Statistics. This marks an acceleration from the 15.2% growth recorded in the first two months of 2025. For the first quarter, enterprise profits expanded by 15.5%, representing the fastest start to any year since 2018, except for the pandemic-driven spike in 2021 [1].\n\nThis robust profit growth occurred despite considerable headwinds from the Middle East conflict, which has disrupted global oil markets and driven up raw material costs. Brent crude oil prices have surged approximately 48% since the onset of U.S.-Israel strikes on Iran at the end of February, increasing costs for chemicals, fibers, and plastics throughout the global supply chain [1]. The rising oil prices have put pressure on manufacturers reliant on imported raw materials, further straining margins amid already tepid domestic demand, a prolonged property market downturn, and a weak job market that has led to price wars across various sectors [1].\n\nNevertheless, a global rally in metal prices and Beijing's initiatives to curb excess production capacity and reduce cutthroat competition have helped ease deflationary pressures. Notably, China's producer price growth turned positive in March, driven by higher oil prices, marking the first expansion in over three years and ending the country's longest deflationary streak in decades [1]. Large onshore inventories of Iranian oil and crude stored on tankers at sea have also provided some buffer for China, the world's largest oil importer [1].\n\n### CONCLUSION\nChina's industrial sector demonstrated strong profit growth in March despite facing significant challenges from surging oil prices and ongoing domestic economic pressures. While government measures and inventory buffers have helped mitigate some risks, external shocks and new sanctions pose ongoing uncertainties for the market.",
        sentiment_score: 0.3
    }
];
