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

/* Keep track of selected products and the conversation */
let selectedProducts = [];
let currentProducts = [];
let messages = [
  {
    role: "system",
    content:
      "You are a friendly L'Oréal routine advisor. Help the user build a practical skincare, haircare, or makeup routine using the products they selected.",
  },
];

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

      return `
    <div class="product-card${isSelected ? " selected" : ""}" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
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
      <div class="selected-product">
        <strong>${product.name}</strong>
        <span>${product.brand}</span>
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
renderSelectedProducts();
