// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import './index.css';

export default function App() {
  const [recipesList, setRecipesList] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchVal, setSearchVal] = useState('');
  const [chefData, setChefData] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All Ratings');
  const [uiLoading, setUiLoading] = useState(false);
  const [viewMode, setViewMode] = useState('browse');

  useEffect(() => {
    // Initial fetch to load recipe grid cards from backend server stream
    fetch('http://localhost:5000/api/recipes')
      .then(res => res.json())
      .then(data => {
        setRecipesList(data);
        if (data.length > 0) setSelectedRecipe(data[0]); // Autofocus first entry card elements
      })
      .catch(err => console.error("Error connecting to database stream:", err));

    // Fetch chef showcase summary parameters for sidebar profile widget
    fetch('http://localhost:5000/api/chef-showcase')
      .then(res => res.json())
      .then(data => setChefData(data))
      .catch(err => console.error("Error matching chef details:", err));
  }, []);

  const runSearchQuery = async () => {
    if (!searchVal.trim()) return;
    setUiLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/recipe?dish=${encodeURIComponent(searchVal)}`);
      if (res.ok) {
        const matchingRecord = await res.json();
        setSelectedRecipe(matchingRecord);
      } else {
        alert("No certified dish found in dataset matching criteria parameters.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUiLoading(false);
    }
  };

  const handleViewGuideClick = () => {
    setViewMode('guide');
  };

  const handleBackToGallery = () => {
    setViewMode('browse');
  };

  if (viewMode === 'guide' && selectedRecipe) {
    return (
      <div className="app-container">
        <header className="main-header">
          <span className="brand-title">Recipe Guide</span>
          <div className="header-actions">
            <button className="icon-btn" type="button" onClick={handleBackToGallery}>⬅</button>
          </div>
        </header>
        <main className="recipes-catalog-pane">
          <div className="category-filter-row">
            <button type="button" className="filter-pill active" onClick={handleBackToGallery}>Back to Gallery</button>
          </div>
          <div className="recipes-grid" style={{ display: 'block' }}>
            <div className="recipe-card" style={{ transform: 'none', border: 'none' }}>
              <div className="image-container">
                <img src={selectedRecipe.imageUrl} alt={selectedRecipe.dishName} />
              </div>
              <div className="recipe-info-block">
                <h2>{selectedRecipe.dishName}</h2>
                <p>{selectedRecipe.description || 'Full preparation guide for this recipe.'}</p>
                <p><strong>Chef:</strong> {selectedRecipe.chef}</p>
                <p><strong>Rating:</strong> {selectedRecipe.rating}</p>
                <p><strong>Time:</strong> {selectedRecipe.totalMinutes || 'N/A'} mins</p>
                <p><strong>Ingredients:</strong> {selectedRecipe.tags.join(', ') || 'N/A'}</p>
                <div style={{ marginTop: '18px' }}>
                  <h4 style={{ marginBottom: '10px' }}>Preparation Steps</h4>
                  <ol style={{ paddingLeft: '20px', color: '#2c3e50' }}>
                    {selectedRecipe.steps.map((step, idx) => (
                      <li key={idx} style={{ marginBottom: '10px' }}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Logic to dynamically filter down the visible dataset grid array based on selected category pill
  const filteredRecipes = recipesList.filter(recipe => {
    if (activeCategory === 'Famous Chefs') return recipe.badgeType === 'famous';
    if (activeCategory === 'Trending Now') return recipe.rating >= 4.6;
    if (activeCategory === 'All Ratings') return true;
    return true; 
  });

  return (
    <div className="app-container">
      {/* 1. STRUCTURAL HEADER COMPONENT VIEW BAR */}
      <header className="main-header">
        <span className="brand-title">Recipes</span>
        <div className="search-wrapper">
          <input 
            type="text" 
            placeholder="Search by dish, chef, or cuisine parameters..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearchQuery()}
          />
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={runSearchQuery} title="Search">🔍</button>
          <button className="icon-btn" title="Bookmarks">🔖</button>
          <button className="icon-btn" title="Notifications">🔔</button>
          <button className="icon-btn" title="User Profile">👤</button>
        </div>
      </header>

      {/* 2. CORE SYSTEM SPLIT DASHBOARD LAYOUT GRID */}
      <div className="dashboard-layout">
        
        {/* LEFT COMPONENT COLUMN: GRID CONTAINER ITEMS */}
        <main className="recipes-catalog-pane">
          <div className="category-filter-row">
            {['Famous Chefs', 'Trending Now', 'All Ratings', 'Cuisine Type', 'Dietary Needs'].map((pill) => (
              <button 
                key={pill} 
                className={`filter-pill ${activeCategory === pill ? 'active' : ''}`}
                onClick={() => setActiveCategory(pill)}
              >
                {pill}
              </button>
            ))}
          </div>

          {uiLoading && <p style={{ color: '#e67e22', marginBottom: '20px', fontWeight: 'bold' }}>Analyzing Kaggle CSV schemas...</p>}

          <div className="recipes-grid">
            {filteredRecipes.map((recipe) => (
              <div 
                key={recipe.id} 
                className="recipe-card"
                onClick={() => setSelectedRecipe(recipe)}
                style={selectedRecipe?.id === recipe.id ? { border: '2px solid #e67e22', transform: 'scale(1.02)' } : {}}
              >
                <div className="image-container">
                  <img src={recipe.imageUrl} alt={recipe.dishName} />
                  <span className={`card-chef-badge ${recipe.badgeType}`}>
                    {recipe.badgeType === 'famous' ? '★' : '✓'} {recipe.badgeText}
                  </span>
                  <button className="bookmark-btn" onClick={(e) => { e.stopPropagation(); alert("Saved to Bookmarks!"); }}>🔖</button>
                </div>
                <div className="recipe-info-block">
                  <h4>{recipe.dishName}</h4>
                  <div className="rating-row">
                    <span>{"★".repeat(Math.round(recipe.rating) || 4)}</span>
                    <span style={{ fontSize: '0.75rem', color: '#7f8c8d', marginLeft: '4px' }}>
                      ({recipe.rating})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* RIGHT COMPONENT COLUMN: ACTIVE SELECTION METRIC GAUGES SIDEBAR */}
        <aside className="utility-sidebar-pane">
          {chefData && (
            <div className="chef-showcase-profile">
              <div className="chef-avatar-wrapper">
                <img src={chefData.avatarUrl} alt={chefData.name} />
              </div>
              <h3>Chef Laure Shan</h3>
              <p style={{ color: '#f1c40f', fontSize: '0.8rem', margin: '4px 0 12px 0' }}>★★★★★ Top Chef</p>
              <p>{chefData.bio}</p>
            </div>
          )}

          {selectedRecipe && (
            <div>
              <hr style={{ border: 'none', borderTop: '1px solid #f5efe6', margin: '20px 0' }} />
              <h3 className="metrics-section-title" style={{ color: '#e67e22' }}>
                Active Selection Metrics
              </h3>
              <p style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '16px' }}>
                Current: {selectedRecipe.dishName} <br />
                <span style={{ fontWeight: 'normal', color: '#7f8c8d' }}>By {selectedRecipe.chef}</span>
              </p>

              <div className="slider-group">
                <label>Ease of Prep ({selectedRecipe.metrics.prepEase}%)</label>
                <input type="range" readOnly className="custom-range-slider" value={selectedRecipe.metrics.prepEase} min="0" max="100" />
              </div>

              <div className="slider-group">
                <label>Flavor Profile ({selectedRecipe.metrics.flavorProfile}%)</label>
                <input type="range" readOnly className="custom-range-slider" value={selectedRecipe.metrics.flavorProfile} min="0" max="100" />
              </div>

              <div className="slider-group">
                <label>Nutritional Density Value ({selectedRecipe.metrics.nutritionalValue}%)</label>
                <input type="range" readOnly className="custom-range-slider" value={selectedRecipe.metrics.nutritionalValue} min="0" max="100" />
              </div>

              <div className="slider-group">
                <label>Complexity Weight ({selectedRecipe.metrics.complexity}%)</label>
                <input type="range" readOnly className="custom-range-slider" value={selectedRecipe.metrics.complexity} min="0" max="100" />
              </div>

              <div style={{ marginTop: '25px' }}>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '10px', color: '#2c3e50', fontWeight: '700' }}>
                  Community Reviews Section
                </h4>
                {selectedRecipe.reviews.map((r, idx) => (
                  <div key={idx} style={{ backgroundColor: '#fbf6ee', padding: '14px', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid #e2d9cb', marginBottom: '8px', lineHeight: '1.4' }}>
                    <strong>{r.user}:</strong> "{r.comment}"
                  </div>
                ))}
              </div>

              <button type="button" className="action-cta-button" onClick={handleViewGuideClick}>
                View Full Preparation Guide
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* 3. STRUCTURAL FOOTER COMPONENT PANEL */}
      <footer className="main-footer">
        <p>© 2026 Gourmet Passport Core interface system engine. All assets indexed accurately from Tasty dataset inputs.</p>
      </footer>
    </div>
  );
}