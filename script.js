/* Get references to DOM elements */
const productSearch = document.getElementById("productSearch");
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const productModal = document.getElementById("productModal");
const closeProductModal = document.getElementById("closeProductModal");
const zoomOutProductModal = document.getElementById("zoomOutProductModal");
const zoomInProductModal = document.getElementById("zoomInProductModal");
const resetProductModalZoom = document.getElementById("resetProductModalZoom");
const productModalZoomLevel = document.getElementById("productModalZoomLevel");
const productModalImage = document.getElementById("productModalImage");
const productModalTitle = document.getElementById("productModalTitle");
const productModalBrand = document.getElementById("productModalBrand");
const productModalDescription = document.getElementById(
  "productModalDescription",
);
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

/* Replace this with your deployed Worker URL if it changes */
const workerUrl = "https://loreal-cloudflare-worker.jason01.workers.dev/";
const selectedProductsStorageKey = "loreal-selected-products";

/* Switch the page direction for RTL languages */
const rtlLanguages = ["ar", "fa", "he", "ur", "ps", "syr", "dv"];
const browserLanguage = navigator.language?.toLowerCase() || "";

if (rtlLanguages.some((language) => browserLanguage.startsWith(language))) {
  document.documentElement.dir = "rtl";
} else {
  document.documentElement.dir = "ltr";
}

/* Keep track of selected products and the conversation */
let allProducts = [];
let selectedProducts = [];
let currentProducts = [];
let activeCategory = "";
let activeSearchTerm = "";
let productModalZoom = 1;
const productModalZoomStep = 0.25;
const productModalZoomMin = 1;
const productModalZoomMax = 2.5;
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

/* Filter products by category and search term */
function filterProducts(products) {
  return products.filter((product) => {
    const matchesCategory = activeCategory
      ? product.category === activeCategory
      : true;

    const searchValue = activeSearchTerm.trim().toLowerCase();
    if (!searchValue) {
      return matchesCategory;
    }

    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(searchValue);

    return matchesCategory && matchesSearch;
  });
}

/* Render the current filtered product list */
function renderFilteredProducts() {
  if (allProducts.length === 0) {
    return;
  }

  const filteredProducts = filterProducts(allProducts);

  if (activeCategory || activeSearchTerm.trim()) {
    displayProducts(filteredProducts);
    return;
  }

  productsContainer.innerHTML = `
    <div class="placeholder-message">
      Select a category or search to view products
    </div>
  `;
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
        <button type="button" class="product-description-toggle">
          Show details
        </button>
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

        const product = products.find((item) => item.id === productId);

        if (product) {
          openProductModal(product);
        }
      });
    });
}

/* Open the product details modal */
function openProductModal(product) {
  productModalImage.src = product.image;
  productModalImage.alt = product.name;
  productModalTitle.textContent = product.name;
  productModalBrand.textContent = product.brand;
  productModalDescription.textContent = product.description;

  setProductModalZoom(1);

  productModal.classList.add("is-open");
  productModal.setAttribute("aria-hidden", "false");
  closeProductModal.focus();
}

/* Update the modal image zoom */
function setProductModalZoom(nextZoom) {
  productModalZoom = Math.min(
    productModalZoomMax,
    Math.max(productModalZoomMin, nextZoom),
  );

  productModalImage.style.transform = `scale(${productModalZoom})`;
  productModalZoomLevel.textContent = `${Math.round(productModalZoom * 100)}%`;

  zoomOutProductModal.disabled = productModalZoom <= productModalZoomMin;
  zoomInProductModal.disabled = productModalZoom >= productModalZoomMax;
}

function zoomProductModal(direction) {
  setProductModalZoom(productModalZoom + direction * productModalZoomStep);
}

/* Close the product details modal */
function closeProductDetailsModal() {
  productModal.classList.remove("is-open");
  productModal.setAttribute("aria-hidden", "true");
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
        <img src="${product.image}" alt="${product.name}">
        <div class="selected-product__content">
          <strong>${product.name}</strong>
          <span>${product.brand}</span>
          <button type="button" class="remove-selected-product" aria-label="Remove ${product.name}">
            Remove
          </button>
        </div>
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
  activeCategory = e.target.value;
  renderFilteredProducts();
});

/* Filter products as the user types */
productSearch.addEventListener("input", (e) => {
  activeSearchTerm = e.target.value;
  renderFilteredProducts();
});

/* Build a short summary of the selected products for the AI */
function getSelectedProductsSummary() {
  if (selectedProducts.length === 0) {
    return "No products selected yet.";
  }

  return selectedProducts.map((product) => `- ${product.name}`).join("\n");
}

/* Convert the assistant's markdown-style reply into readable HTML */
function formatAssistantReply(replyText) {
  const sections = replyText
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections
    .map((section) => {
      const listItems = section.match(/^[-*•]\s.+/gm);

      if (listItems) {
        const listHtml = section
          .split(/\n/)
          .filter((line) => /^[-*•]\s/.test(line.trim()))
          .map((line) => `<li>${line.replace(/^[-*•]\s/, "")}</li>`)
          .join("");

        return `<ul>${listHtml}</ul>`;
      }

      const normalizedText = section
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br />");

      return `<p>${normalizedText}</p>`;
    })
    .join("");
}

/* Find product names mentioned in the assistant reply */
function getProductsMentionedInReply(replyText) {
  const normalizedReply = replyText.toLowerCase();
  const catalog = allProducts.length > 0 ? allProducts : selectedProducts;

  return catalog.filter((product) => {
    const productName = product.name.toLowerCase();
    const brandName = product.brand.toLowerCase();
    const combinedName = `${brandName} ${productName}`;

    return (
      normalizedReply.includes(combinedName) ||
      normalizedReply.includes(productName) ||
      normalizedReply.includes(brandName)
    );
  });
}

/* Build a small product image gallery for advice that mentions products */
function renderAdviceProducts(products) {
  if (products.length === 0) {
    return "";
  }

  const uniqueProducts = products.filter(
    (product, index, array) =>
      array.findIndex((item) => item.id === product.id) === index,
  );

  const galleryHtml = uniqueProducts
    .slice(0, 4)
    .map(
      (product) => `
        <button type="button" class="advice-product-card" data-product-id="${product.id}" aria-label="Open details for ${product.name}">
          <img src="${product.image}" alt="${product.name}">
          <div>
            <strong>${product.name}</strong>
            <span>${product.brand}</span>
          </div>
        </button>
      `,
    )
    .join("");

  return `
    <div class="advice-products">
      <span class="advice-products-label">Products mentioned</span>
      <div class="advice-products-grid">${galleryHtml}</div>
    </div>
  `;
}

/* Build a compact image gallery for the user's routine request */
function renderRequestProducts(products) {
  if (products.length === 0) {
    return "";
  }

  const uniqueProducts = products.filter(
    (product, index, array) =>
      array.findIndex((item) => item.id === product.id) === index,
  );

  const galleryHtml = uniqueProducts
    .slice(0, 4)
    .map(
      (product) => `
        <div class="request-product-card">
          <img src="${product.image}" alt="${product.name}">
          <div>
            <strong>${product.name}</strong>
            <span>${product.brand}</span>
          </div>
        </div>
      `,
    )
    .join("");

  return `
    <div class="request-products">
      <span class="request-products-label">Selected products</span>
      <div class="request-products-grid">${galleryHtml}</div>
    </div>
  `;
}

/* Find a product by its ID from the loaded catalog or selected products */
function findProductById(productId) {
  const catalog = allProducts.length > 0 ? allProducts : selectedProducts;
  return catalog.find((product) => product.id === productId);
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

/* Open product details when a mentioned product is clicked in the chat */
chatWindow.addEventListener("click", (e) => {
  const adviceCard = e.target.closest(".advice-product-card");

  if (!adviceCard) {
    return;
  }

  const productId = Number(adviceCard.dataset.productId);

  if (Number.isNaN(productId)) {
    return;
  }

  const product = findProductById(productId);

  if (product) {
    openProductModal(product);
  }
});

/* Send the conversation to the worker and show the answer */
function scrollChatToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage(userText, options = {}) {
  const requestProducts = Array.isArray(options.products)
    ? options.products
    : [];

  if (requestProducts.length > 0) {
    messages.push({
      role: "user",
      content: `Selected products:\n${requestProducts
        .map((product) => `- ${product.name}`)
        .join("\n")}`,
    });
  }

  messages.push({ role: "user", content: userText });

  chatWindow.insertAdjacentHTML(
    "beforeend",
    `
    <div class="chat-message user-message">
      ${renderRequestProducts(requestProducts)}
      <strong>You:</strong> ${userText}
    </div>
  `,
  );
  scrollChatToBottom();

  const thinkingBubble = document.createElement("div");
  thinkingBubble.className = "chat-message bot-message thinking-message";
  thinkingBubble.innerHTML = `
    <strong>Advisor:</strong>
    <div class="chat-message-content">
      <span class="thinking-dots" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
      <span>Thinking...</span>
    </div>
  `;
  chatWindow.appendChild(thinkingBubble);
  scrollChatToBottom();

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

  thinkingBubble.remove();
  messages.push({ role: "assistant", content: reply });
  const mentionedProducts = getProductsMentionedInReply(reply);

  chatWindow.insertAdjacentHTML(
    "beforeend",
    `
    <div class="chat-message bot-message">
      <strong>Advisor:</strong>
      <div class="chat-message-content">${formatAssistantReply(reply)}</div>
      ${renderAdviceProducts(mentionedProducts)}
    </div>
  `,
  );
  scrollChatToBottom();
}

/* Create the first routine from the selected products */
generateRoutineButton.addEventListener("click", async () => {
  const prompt = "Build a personalized routine using the selected products.";

  chatWindow.innerHTML = "";
  await sendMessage(prompt, { products: selectedProducts });
});

/* Clear all saved selections */
const clearSelectionsButton = document.getElementById("clearSelections");

clearSelectionsButton.addEventListener("click", () => {
  clearSelectedProducts();
});

productModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-modal-close")) {
    closeProductDetailsModal();
  }
});

closeProductModal.addEventListener("click", () => {
  closeProductDetailsModal();
});

zoomOutProductModal.addEventListener("click", () => {
  zoomProductModal(-1);
});

zoomInProductModal.addEventListener("click", () => {
  zoomProductModal(1);
});

resetProductModalZoom.addEventListener("click", () => {
  setProductModalZoom(1);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && productModal.classList.contains("is-open")) {
    closeProductDetailsModal();
  }
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

/* Load products once and reuse them for category and search filtering */
loadProducts().then((products) => {
  allProducts = products;
  renderFilteredProducts();
});
