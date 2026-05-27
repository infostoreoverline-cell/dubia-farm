/**
 * D.U.B.I.A. — Number Scramble (Matrix Effect)
 * Scrambles characters for 300ms before revealing the real value
 */

'use strict';

const scrambleChars = '0123456789.%€gθ-+';

const numberScramble = (element, finalText, duration = 300) => {
    if (!element) return;

    const steps = Math.floor(duration / 30);
    let currentStep = 0;

    element.classList.add('number-scramble-blur');

    const interval = setInterval(() => {
        if (currentStep >= steps) {
            clearInterval(interval);
            element.textContent = finalText;
            element.classList.remove('number-scramble-blur');
            element.classList.add('number-scrambling');
            setTimeout(() => element.classList.remove('number-scrambling'), 300);
            return;
        }

        // Generate random scramble text of same length
        let scrambled = '';
        for (let i = 0; i < finalText.length; i++) {
            if (finalText[i] === ' ' || finalText[i] === '/' || finalText[i] === ':') {
                scrambled += finalText[i];
            } else {
                scrambled += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
            }
        }
        element.textContent = scrambled;
        currentStep++;
    }, 30);
};

/**
 * Scramble all [data-scramble] elements that have changed
 */
const scrambleUpdatedValues = (updates) => {
    Object.entries(updates).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== value) {
            numberScramble(el, value);
        }
    });
};
