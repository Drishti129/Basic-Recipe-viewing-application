const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
let kaggleRecipeDatabase = [];

const chefShowcaseProfile = {
  name: 'Laure Shan',
  avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
  bio: 'Seasoned pastry chef blending international flavor narratives with fast-casual kitchen artistry.'
};

function parseStructuralColumn(rawString, fallback = []) {
  if (!rawString || rawString.trim() === '' || rawString === '[]') return fallback;
  try {
    const jsonReady = rawString
      .replace(/'/g, '"')
      .replace(/None/g, 'null')
      .replace(/True/g, 'true')
      .replace(/False/g, 'false');
    return JSON.parse(jsonReady);
  } catch (err) {
    const displayPattern = /'display_text':\s*"([^"]+)"|'display_text':\s*'([^']+)'/g;
    const matchedSteps = [];
    let match;
    while ((match = displayPattern.exec(rawString)) !== null) {
      matchedSteps.push(match[1] || match[2]);
    }
    return matchedSteps.length > 0 ? matchedSteps : fallback;
  }
}

function parseCsvLine(line) {
  const row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  row.push(current);
  return row;
}

function parseCsvRows(source) {
  const rows = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      current += char;
      if (source[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\r') {
      continue;
    } else if (char === '\n' && !inQuotes) {
      if (current.trim() !== '') rows.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim() !== '') rows.push(current);
  return rows;
}

function normalizeRecipeRow(row) {
  const dishName = row.name || row.dishName;
  const id = row.id;
  if (!dishName || !id) return null;

  const credits = parseStructuralColumn(row.credits, []);
  const instructions = parseStructuralColumn(row.instructions, []);
  const nutrition = parseStructuralColumn(row.nutrition, {});
  const userRatings = row.user_ratings
    ? parseStructuralColumn(row.user_ratings, { score: 0.9, count: 0 })
    : { score: parseFloat(row.rating) || 0.9, count: 0 };

  let verifiedChef = row.chef || 'Certified Tasty Specialist';
  if (credits.length > 0 && credits[0].name) {
    verifiedChef = credits[0].name;
  }

  let stepsArray = [];
  if (Array.isArray(instructions)) {
    stepsArray = instructions.map(step =>
      typeof step === 'object' && step.display_text ? step.display_text : String(step)
    );
  } else if (typeof instructions === 'string' && instructions.trim()) {
    stepsArray = instructions
      .split(/\s*\n|\.\s*/)
      .map(step => step.trim())
      .filter(Boolean);
  }
  if (stepsArray.length === 0 && row.instructions) {
    stepsArray = [String(row.instructions).trim()];
  }

  const keywords = (row.keywords || row.tags || row.ingredients || '').replace(/[\[\]"']/g, '');
  const ingredientTags = keywords
    .split(/,|\||;/)
    .map(k => k.trim())
    .filter(Boolean)
    .slice(0, 8);

  const totalMinutes =
    parseInt(row.total_time_minutes) ||
    parseInt(row.prep_time_minutes) ||
    parseInt(row.cook_time_minutes) ||
    parseInt(row.totalMinutes) ||
    35;
  const easeValue = Math.max(15, Math.min(100, 115 - totalMinutes));
  const flavorProfile = Math.min(100, Math.max(25, Math.round((userRatings.score || 0.9) * 100)));
  const nutritionalValue = Math.min(100, Math.max(25, Math.round((nutrition.calories || 300) / 6)));
  const complexityValue = Math.min(100, Math.max(20, ingredientTags.length * 10));

  const badgeType = row.badgeType || (/vegan|healthy|dietary|low-carb/i.test(keywords) ? 'verified' : 'famous');
  const badgeText = row.badgeText || (badgeType === 'famous' ? 'Chef Pick' : 'Verified');

  return {
    id,
    dishName,
    chef: verifiedChef,
    imageUrl: row.imageUrl || row.thumbnail_url || row.renditions || '',
    badgeType,
    badgeText,
    rating: parseFloat(((userRatings.score || 0.9) * 1).toFixed(2)),
    metrics: {
      prepEase: Math.min(100, Math.max(15, parseInt(row.prepEase) || easeValue)),
      flavorProfile: parseInt(row.flavorProfile) || flavorProfile,
      nutritionalValue: parseInt(row.nutritionalValue) || nutritionalValue,
      complexity: parseInt(row.complexity) || complexityValue
    },
    reviews: [
      { user: 'TastyFan', comment: 'This recipe is easy and delicious.' },
      { user: 'Foodie', comment: 'The flavors are outstanding.' }
    ],
    description: row.description || row.reviewComment || `${dishName} by ${verifiedChef}`,
    tags: ingredientTags,
    steps: stepsArray,
    nutrition,
    totalMinutes
  };
}

function initializeDataPipeline() {
  const datasetLocation = path.join(__dirname, 'recipies.csv');
  if (!fs.existsSync(datasetLocation)) {
    console.error(`[CRITICAL] recipes.csv not located at ${datasetLocation}. Ingestion halted.`);
    return;
  }

  console.log('[SYS-LOG] Streaming Kaggle recipe matrices into application cache memory...');
  const source = fs.readFileSync(datasetLocation, 'utf-8');
  const rows = parseCsvRows(source);
  if (rows.length <= 1) {
    console.warn('[WARN] recipes.csv has no data rows.');
    return;
  }

  const header = parseCsvLine(rows[0]).map(cell => cell.trim());
  for (let i = 1; i < rows.length; i += 1) {
    const values = parseCsvLine(rows[i]);
    if (values.length !== header.length) {
      console.warn(`[DATA] Skipping malformed CSV row ${i + 1}.`);
      continue;
    }

    const row = {};
    header.forEach((key, index) => {
      row[key] = values[index];
    });

    const recipe = normalizeRecipeRow(row);
    if (recipe) kaggleRecipeDatabase.push(recipe);
  }

  console.log(`[SYS-LOG] Loaded ${kaggleRecipeDatabase.length} recipes into cache.`);
}

function ensureRecipeCount(recipes, count = 8) {
  if (recipes.length >= count) return recipes.slice(0, count);

  const styleSuffixes = [
    'Deluxe',
    'Express',
    'Signature',
    'Harvest',
    'Seasonal',
    'Herb-Infused',
    'Spicy',
    'Chef Special'
  ];

  const extended = [...recipes];
  let addIndex = 0;

  while (extended.length < count && recipes.length > 0) {
    const base = recipes[addIndex % recipes.length];
    const variantIndex = extended.length - recipes.length;
    const suffix = styleSuffixes[variantIndex % styleSuffixes.length];
    const chefSuffix = suffix === 'Spicy' ? ' the Bold' : suffix === 'Herb-Infused' ? ' the Herbalist' : suffix === 'Express' ? ' Express' : '';

    extended.push({
      ...base,
      id: `${base.id}-var-${variantIndex + 1}`,
      dishName: `${base.dishName} ${suffix}`,
      chef: `${base.chef}${chefSuffix}`.trim(),
      rating: Math.min(5, parseFloat((base.rating + 0.05 * (variantIndex + 1)).toFixed(2))),
      badgeType: variantIndex % 2 === 0 ? 'famous' : 'verified',
      badgeText: variantIndex % 2 === 0 ? 'Chef Pick' : 'Verified',
      description: `${base.description} A ${suffix.toLowerCase()} variation for busy weeknights.`,
      tags: Array.from(new Set([...base.tags, suffix.toLowerCase()])).slice(0, 8)
    });
    addIndex += 1;
  }

  return extended.slice(0, count);
}

function sendJson(res, payload, status = 200) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function handleRequest(req, res) {
  const baseUrl = `http://${req.headers.host || '127.0.0.1:5000'}`;
  const parsed = new URL(req.url, baseUrl);
  let pathname = parsed.pathname.replace(/\/+$/, '');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (pathname === '/api/recipes') {
    return sendJson(res, ensureRecipeCount(kaggleRecipeDatabase, 8));
  }

  if (pathname === '/api/chef-showcase') {
    return sendJson(res, chefShowcaseProfile);
  }

  if (pathname === '/api/recipe') {
    const dish = (parsed.searchParams.get('dish') || '').toLowerCase().trim();
    if (!dish) {
      return sendJson(res, { error: 'dish query parameter is required' }, 400);
    }

    const found = kaggleRecipeDatabase.find(recipe =>
      recipe.dishName.toLowerCase().includes(dish) ||
      recipe.chef.toLowerCase().includes(dish) ||
      recipe.tags.some(tag => tag.toLowerCase().includes(dish))
    );

    if (!found) {
      return sendJson(res, { error: 'No matching recipe found' }, 404);
    }

    return sendJson(res, found);
  }

  sendJson(res, { error: 'Endpoint not found' }, 404);
}

initializeDataPipeline();

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`[SERVER] Listening on http://localhost:${PORT}`);
});
