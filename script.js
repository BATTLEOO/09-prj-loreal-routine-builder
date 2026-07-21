/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

/* Replace this with your deployed Worker URL if it changes */
const workerUrl = "https://loreal-cloudflare-worker.jason01.workers.dev/";
const selectedProductsStorageKey = "loreal-selected-products";

/* Keep track of selected products and the conversation */
let selectedProducts = [];
let currentProducts = [];
let expandedProductIds = [];
let messages = [
  {
    role: "system",
    content:
      "You are a friendly L'Oréal routine advisor. Help the user build a practical skincare, haircare, or makeup routine using the products they selected.",
  },
];

/* Load saved selections from the browser */
function loadSelectedProducts() {
  try {
    const savedProducts = localStorage.getItem(selectedProductsStorageKey);

    if (!savedProducts) {
      return;
    }

    const parsedProducts = JSON.parse(savedProducts);

    if (Array.isArray(parsedProducts)) {
      selectedProducts = parsedProducts;
    }
  } catch (error) {
    selectedProducts = [];
  }
}

/* Save the current selections to the browser */
function saveSelectedProducts() {
  try {
    localStorage.setItem(
      selectedProductsStorageKey,
      JSON.stringify(selectedProducts),
    );
  } catch (error) {
    /* Ignore storage errors so the page still works normally. */
  }
}

/* Remove all selected products */
function clearSelectedProducts() {
  selectedProducts = [];
  saveSelectedProducts();
  renderSelectedProducts();

  if (currentProducts.length > 0) {
    displayProducts(currentProducts);
  }
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  currentProducts = products;

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some(
        (selectedProduct) => selectedProduct.id === product.id,
      );
      const isDescriptionOpen = expandedProductIds.includes(product.id);

      return `
    <div class="product-card${isSelected ? " selected" : ""}" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button type="button" class="product-description-toggle" aria-expanded="${isDescriptionOpen}" aria-controls="product-description-${product.id}">
          ${isDescriptionOpen ? "Hide details" : "Show details"}
        </button>
        <p class="product-description${isDescriptionOpen ? " visible" : ""}" id="product-description-${product.id}">
          ${product.description}
        </p>
      </div>
    </div>
  `;
    })
    .join("");

  /* Let the user click a card to add or remove a product */
  productsContainer.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const productId = Number(card.dataset.productId);
      toggleSelectedProduct(productId, products);
    });
  });

  productsContainer
    .querySelectorAll(".product-description-toggle")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();

        const card = button.closest(".product-card");
        const productId = Number(card?.dataset.productId);

        if (Number.isNaN(productId)) {
          return;
        }

        if (expandedProductIds.includes(productId)) {
          expandedProductIds = expandedProductIds.filter(
            (expandedId) => expandedId !== productId,
          );
        } else {
          expandedProductIds.push(productId);
        }

        displayProducts(products);
      });
    });
}

/* Show the products the user picked */
function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = "<p>No products selected yet.</p>";
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-product" data-product-id="${product.id}">
        <strong>${product.name}</strong>
        <span>${product.brand}</span>
        <button type="button" class="remove-selected-product" aria-label="Remove ${product.name}">
          Remove
        </button>
      </div>
    `,
    )
    .join("");
}

/* Add a product to the selected list or remove it if it's already there */
function toggleSelectedProduct(productId, allProducts) {
  const existingIndex = selectedProducts.findIndex(
    (product) => product.id === productId,
  );

  if (existingIndex >= 0) {
    selectedProducts.splice(existingIndex, 1);
  } else {
    const product = allProducts.find((item) => item.id === productId);
    if (product) {
      selectedProducts.push(product);
    }
  }

  saveSelectedProducts();
  renderSelectedProducts();
  displayProducts(allProducts || currentProducts);
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

/* Build a short summary of the selected products for the AI */
function getSelectedProductsSummary() {
  if (selectedProducts.length === 0) {
    return "No products selected yet.";
  }

  return selectedProducts
    .map(
      (product) => `${product.brand} - ${product.name}: ${product.description}`,
    )
    .join("\n");
}

/* Send the selected products as structured data to the worker */
function getSelectedProductsPayload() {
  return selectedProducts.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
    image: product.image,
  }));
}

/* Handle clicks on the selected products list */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-selected-product");

  if (!removeButton) {
    return;
  }

  const selectedCard = removeButton.closest(".selected-product");
  const productId = Number(selectedCard?.dataset.productId);

  if (!Number.isNaN(productId)) {
    selectedProducts = selectedProducts.filter(
      (product) => product.id !== productId,
    );
    saveSelectedProducts();
    renderSelectedProducts();

    if (currentProducts.length > 0) {
      displayProducts(currentProducts);
    }
  }
});

/* Send the conversation to the worker and show the answer */
async function sendMessage(userText) {
  messages.push({ role: "user", content: userText });

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      selectedProducts: getSelectedProductsPayload(),
    }),
  });

  const data = await response.json();
  const reply =
    data?.choices?.[0]?.message?.content ||
    "Sorry, I could not get a reply right now.";

  messages.push({ role: "assistant", content: reply });

  chatWindow.innerHTML += `
    <div class="chat-message user-message"><strong>You:</strong> ${userText}</div>
    <div class="chat-message bot-message"><strong>Advisor:</strong> ${reply}</div>
  `;
}

/* Create the first routine from the selected products */
generateRoutineButton.addEventListener("click", async () => {
  const prompt = "Build a personalized routine using the selected products.";

  chatWindow.innerHTML = "";
  await sendMessage(prompt);
});

/* Clear all saved selections */
const clearSelectionsButton = document.getElementById("clearSelections");

clearSelectionsButton.addEventListener("click", () => {
  clearSelectedProducts();
});

/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = userInput.value.trim();

  if (!userText) {
    return;
  }

  userInput.value = "";

  await sendMessage(userText);
});

/* Show the empty selected products state on load */
loadSelectedProducts();
renderSelectedProducts();
