// Sursele de stiri. Fiecare sursa are un `weight` (0.5 - 1.5) folosit ca
// multiplicator la scorul de importanta: blogurile oficiale ale laboratoarelor
// cantaresc mai mult decat agregatoarele.
//
// Daca un feed moare, pipeline-ul il sare si continua (vezi collect.js).
// Ruleaza `npm run collect` ca sa vezi ce feed-uri raspund.

export const RSS_FEEDS = [
  // --- Bloguri oficiale AI labs (autoritate maxima) ---
  // Anthropic, Mistral AI si Meta AI nu au (momentan) un feed RSS public functional —
  // stirile lor majore sunt oricum preluate rapid de presa tech + The Decoder + HN de mai jos.
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', weight: 1.5, tag: 'lab' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', weight: 1.4, tag: 'lab' },
  { name: 'Google Research', url: 'https://research.google/blog/rss/', weight: 1.2, tag: 'lab' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', weight: 1.1, tag: 'lab' },
  { name: 'Microsoft Blog', url: 'https://blogs.microsoft.com/feed/', weight: 1.0, tag: 'lab' },
  { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/', weight: 1.1, tag: 'lab' },
  { name: 'AWS Machine Learning', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', weight: 1.0, tag: 'lab' },

  // --- Presa tech ---
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', weight: 1.2, tag: 'presa' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', weight: 1.2, tag: 'presa' },
  { name: 'Ars Technica AI', url: 'https://arstechnica.com/ai/feed/', weight: 1.1, tag: 'presa' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', weight: 1.0, tag: 'presa' },
  { name: 'MIT Tech Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', weight: 1.2, tag: 'presa' },
  { name: 'Wired', url: 'https://www.wired.com/feed/tag/ai/latest/rss', weight: 1.0, tag: 'presa' },
  { name: 'ZDNet AI', url: 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml', weight: 0.9, tag: 'presa' },
  { name: 'The Register AI', url: 'https://www.theregister.com/software/ai_ml/headlines.atom', weight: 0.9, tag: 'presa' },
  { name: 'The Decoder', url: 'https://the-decoder.com/feed/', weight: 1.1, tag: 'presa' },
  { name: 'MarkTechPost', url: 'https://www.marktechpost.com/feed/', weight: 0.9, tag: 'presa' },

  // --- Newslettere / analiza ---
  { name: 'Import AI (Jack Clark)', url: 'https://importai.substack.com/feed', weight: 1.4, tag: 'analiza' },
  { name: "Ben's Bites", url: 'https://bensbites.com/feed', weight: 1.0, tag: 'analiza' },
  { name: 'Latent Space', url: 'https://www.latent.space/feed', weight: 1.2, tag: 'analiza' },
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', weight: 1.2, tag: 'analiza' },
  { name: 'One Useful Thing (Ethan Mollick)', url: 'https://www.oneusefulthing.org/feed', weight: 1.2, tag: 'analiza' },
  { name: 'Interconnects', url: 'https://www.interconnects.ai/feed', weight: 1.1, tag: 'analiza' },
  { name: 'Marginal Revolution', url: 'https://marginalrevolution.com/feed', weight: 0.7, tag: 'analiza' },

  // --- Business / reglementare ---
  { name: 'AI Business', url: 'https://aibusiness.com/rss.xml', weight: 0.9, tag: 'business' },
  { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/', weight: 0.9, tag: 'business' },
];

// Hacker News prin API-ul public Algolia. Fara cheie, fara limite practice.
export const HN_CONFIG = {
  enabled: true,
  minPoints: 80,
  queries: ['AI', 'LLM', 'OpenAI', 'Anthropic', 'Claude', 'GPT', 'machine learning', 'agent'],
  weight: 1.0,
};

// Reddit prin feed-urile RSS publice (nu necesita autentificare).
export const REDDIT_CONFIG = {
  enabled: true,
  subreddits: ['LocalLLaMA', 'MachineLearning', 'artificial', 'OpenAI', 'singularity'],
  weight: 0.85,
};

// arXiv: articole noi din categoriile relevante.
export const ARXIV_CONFIG = {
  enabled: true,
  categories: ['cs.AI', 'cs.CL', 'cs.LG'],
  maxPerCategory: 25,
  weight: 0.9,
};

// Conturi X de referinta. Momentan NEFOLOSITE (X API costa ~200 USD/luna).
// Sunt aici ca lista de lucru pentru cand/daca activam modulul X.
export const X_ACCOUNTS_WATCHLIST = [
  '@sama', '@AnthropicAI', '@OpenAI', '@GoogleDeepMind', '@ylecun', '@karpathy',
  '@DrJimFan', '@swyx', '@simonw', '@emollick', '@AndrewYNg', '@_akhaliq',
  '@rowancheung', '@mattshumer_', '@alexalbert__', '@JeffDean', '@demishassabis',
];
