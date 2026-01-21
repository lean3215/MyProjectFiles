const paymentForm = document.getElementById('form');
const submitBtn = document.getElementById('submit-btn');


// Payment methods

const bankMethod = document.getElementById('drbank');
const qrMethod = document.getElementById('qr');
const paypalMethod = document.getElementById('paypal');


if (paymentForm) {
    paymentForm.addEventListener('submit', handlePayment);
}


// Function to handle payment submission

async function handlePayment(e) {
    e.preventDefault();
    console.log('Form submitted, checking payment method...');


    // Selecting payment method
    let selectedPaymentMethod = null;
    if (qrMethod.checked) { selectedPaymentMethod = 'qr' }
    else if (paypalMethod.checked) { selectedPaymentMethod = 'paypal' }
    else { selectedPaymentMethod = 'drbank' };
    console.log("Payment method: ", selectedPaymentMethod);


    // Only continue with Stripe card payment if "card" is selected
    if (selectedPaymentMethod === 'drbank') {
        console.log('Direct bank transfer selected, proceeding with Stripe initialization');

        // Store customer info in sessionStorage as backup in case DOM elements are lost
        try {
            const customerInfo = {
                name: document.getElementById('name')?.value.trim() || '',
                email: document.getElementById('email')?.value.trim() || '',
                phone: document.getElementById('phone')?.value.trim() || '',
                address: document.getElementById('address')?.value.trim() || ''
            };

            // Save to sessionStorage with proper error handling
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('customerInfo', JSON.stringify(customerInfo));
            }
        } catch (e) {
            console.warn('Could not store customer info in sessionStorage:', e);
        }

        // Check if Stripe is initialized
        if (!stripeInitialized || !stripe || !cardElement) {
            console.error('Stripe not properly initialized!');

            // Try re-initializing Stripe one more time
            console.log('Attempting to reinitialize Stripe...');
            const initialized = await initializeStripe();

            if (!initialized) {
                if (stripeResourcesBlocked) {
                    showError('Payment processing is blocked. Please disable ad blockers or use a different browser.');
                } else {
                    showError('Payment system not ready. Please refresh the page and try again.');
                }
                return;
            }
        }

        // Basic form validation
        const name = document.getElementById('name').value.trim();
        const address = document.getElementById('address').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim();

        if (!name || !address || !phone || !email) {
            showError('Please fill in all required fields.');
            return;
        }

        // Show processing UI
        showProcessingUI();

        // Disable the submit button to prevent double submission
        document.getElementById('confirmOrder').disabled = true;

        try {
            console.log('Creating payment intent with session ID:', paymentSessionId);
            const response = await fetch('./php/stripe-handler.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'create_intent',
                    amount: Math.round(total * 100),
                    customerInfo: { name, email, phone, address },
                    metadata: {
                        customer_name: name,
                        customer_email: email,
                        timestamp: new Date().toISOString(),
                        cart_item_count: cart.length,
                        session_id: paymentSessionId,
                        from_direct_checkout: isDirectCheckout
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error('Payment processing issue. Please try again later.');
            }

            const paymentData = await response.json();

            if (paymentData.status === 'error') {
                console.error('Payment error from server:', paymentData.message);
                throw new Error(paymentData.message || 'Payment processing issue. Please try again later.');
            }

            if (!paymentData.clientSecret) {
                throw new Error('No client secret received from server');
            }

            clientSecret = paymentData.clientSecret;
            stripePaymentIntentId = paymentData.paymentIntentId;

            openPaymentModal();

        } catch (error) {
            console.error('Payment process error:', error);
            hideProcessingUI();
            showError(`Payment failed: ${error.message}`);

            document.getElementById('confirmOrder').disabled = false;

            const paymentFallback = document.getElementById('payment-fallback');
            if (paymentFallback) {
                paymentFallback.style.display = 'block';
            }
        }
    } else if (selectedPaymentMethod === 'qr') {
        createPaymentModal();
    } else if (selectedPaymentMethod === 'paypal') {
        // PayPal is handled separately through its own buttons
        console.log('PayPal selected, no action needed as PayPal has its own buttons');
        return;
    }


    // Create popup modal for payment form
    function createPaymentModal() {
        // Create modal container if it doesn't exist yet
        if (!document.getElementById('payment-modal')) {
            const modalHtml = `
            <div id="payment-modal" class="modal" role="dialog" aria-labelledby="modal-payment-title" aria-modal="true">
                <div class="modal-content">
                    <span class="close-button" aria-label="Close payment form" tabindex="0" role="button">&times;</span>
                    <h2 id="modal-payment-title">Payment Details</h2>
                    <div class="payment-form-container">
                        <label for="modal-card-element" class="card-element-label">Card Information</label>
                        <div id="modal-card-element"></div>
                        <div id="modal-card-errors" role="alert" style="color: #e74c3c; margin-top: 10px; font-size: 14px;"></div>
                    </div>
                    <button id="modal-submit-payment" class="btn" style="margin-top: 20px; width: 100%;">Pay Now</button>
                </div>
            </div>
        `;

            // Add modal HTML to page
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            document.body.appendChild(modalContainer.firstElementChild);

            // Add event listeners for modal
            const closeButton = document.querySelector('.close-button');
            closeButton.addEventListener('click', closePaymentModal);

            // Add keyboard support for closing modal (ESC key)
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    closePaymentModal();
                }
            });

            // Make close button accessible via keyboard
            closeButton.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    closePaymentModal();
                }
            });

        }
    }

    // Open payment modal
    function openPaymentModal() {
        const modal = document.getElementById('payment-modal');
        modal.style.display = 'block';

        // Store the element that had focus before opening the modal
        modal.previouslyFocused = document.activeElement;

        // Set focus on the first focusable element in the modal
        setTimeout(() => {
            if (cardElement) {
                cardElement.focus();
            } else {
                // If card element isn't ready, focus the close button
                const closeButton = modal.querySelector('.close-button');
                if (closeButton) closeButton.focus();
            }
        }, 100);

        // Add keyboard trap to keep focus inside modal for accessibility
        document.addEventListener('keydown', trapFocusInModal);
    }

    // Close payment modal
    function closePaymentModal() {
        const modal = document.getElementById('payment-modal');
        modal.style.display = 'none';

        // Remove keyboard trap
        document.removeEventListener('keydown', trapFocusInModal);

        // Return focus to the element that had focus before the modal was opened
        if (modal.previouslyFocused) {
            modal.previouslyFocused.focus();
        }
    }

}