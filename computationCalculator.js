const result = document.getElementById('result');
const kDigitResult = document.getElementById('kDigitResult');
const absoluteErrorResult = document.getElementById('absoluteErrorResult');
const relativeErrorResult = document.getElementById('relativeErrorResult');
const maximumErrorResult = document.getElementById('maximumErrorResult');
const significantDigitsResult = document.getElementById('significantDigitsResult');

let p;
let rawResult;

function initializeComputationCalculator() {
    document.getElementById('computeBtn').addEventListener('click', handleComputeExpression);
    document.getElementById('applyChopRoundBtn').addEventListener('click', handleApplyChopRound);
    document.getElementById('evaluateKDigitBtn').addEventListener('click', handleEvaluateKDigit);
}

function handleComputeExpression() {
    const expression = document.getElementById('polynomialFunction').value.trim();
    const scope = getPolynomialScope();

    if (!expression) {
        alert('Please enter an expression to compute');
        return;
    }

    p = evalPolynomial(expression, scope);
    if (typeof p === 'string' && p.startsWith('Error:')) {
        alert(p);
        return;
    }

    rawResult = p;
    result.value = p.toString();
    clearComputedErrorOutputs();
}

function handleApplyChopRound() {
    if (rawResult === undefined) {
        alert('Please calculate a result first');
        return;
    }

    let selectedMethod = document.querySelector('input[name="method"]:checked');
    if (!selectedMethod) {
        alert('Please select chop or round');
        return;
    }
    selectedMethod = selectedMethod.value;

    const significantValue = parseInt(document.getElementById('significantDigits').value);
    if (isNaN(significantValue) || significantValue < 1) {
        alert('Please enter a positive integer for significant digits');
        return;
    }

    p = selectedMethod === 'chop'
        ? chopNums(rawResult, significantValue)
        : roundNums(rawResult, significantValue);

    displayResultWithErrors(p, rawResult, significantValue, selectedMethod);
}

function handleEvaluateKDigit(event) {
    event.preventDefault();

    const expression = document.getElementById('polynomialFunction').value.trim();
    const kDigits = parseInt(document.getElementById('kDigits').value);
    const methodElement = document.querySelector('input[name="kMethod"]:checked');

    if (!methodElement) {
        alert('Please select chop or round for K-digit arithmetic');
        return;
    }
    if (!expression) {
        alert('Please enter an expression to evaluate using K-digit arithmetic');
        return;
    }
    if (isNaN(kDigits) || kDigits <= 0) {
        alert('Please enter a positive number of significant digits for K-digit arithmetic');
        return;
    }

    try {
        const kResult = evaluateExpressionKDigit(expression, getPolynomialScope(), kDigits, methodElement.value);
        kDigitResult.value = kResult.toString();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function getPolynomialScope() {
    const rawX = document.getElementById('polynomialVariable').value;
    const xValue = rawX === '' ? undefined : parseFloat(rawX);
    const scope = {};

    if (!isNaN(xValue)) {
        scope.x = math.bignumber(xValue);
    }

    return scope;
}

function clearComputedErrorOutputs() {
    kDigitResult.value = '';
    absoluteErrorResult.value = '';
    relativeErrorResult.value = '';
    maximumErrorResult.value = '';
    significantDigitsResult.value = '';
}

function displayResultWithErrors(processedResult, rawResult, significantDigits, method) {
    result.value = processedResult.toString();

    const absErr = absoluteError(rawResult, processedResult);
    const relErr = relativeError(rawResult, processedResult);
    const maxErr = maximumAbsoluteError(rawResult, significantDigits, method);

    absoluteErrorResult.value = absErr.toString();
    relativeErrorResult.value = relErr.toExponential(4);
    maximumErrorResult.value = maxErr.toExponential(4);
    significantDigitsResult.value = significantDigits;
}

function evalNodeKDigit(node, scope, k, method) {
    const process = (x) => (method === 'chop' ? chopNums(x, k) : roundNums(x, k));

    switch (node.type) {
        case 'ConstantNode':
            return process(math.bignumber(node.value));

        case 'SymbolNode':
            if (scope[node.name] !== undefined) return math.bignumber(scope[node.name]);
            throw new Error(`Undefined variable: ${node.name}`);

        case 'OperatorNode': {
            const args = node.args.map(arg => evalNodeKDigit(arg, scope, k, method));
            let res;
            switch (node.op) {
                case '+': res = math.add(args[0], args[1]); break;
                case '-': res = math.subtract(args[0], args[1]); break;
                case '*': res = math.multiply(args[0], args[1]); break;
                case '/': res = math.divide(args[0], args[1]); break;
                case '^': res = math.pow(args[0], args[1]); break;
                default: throw new Error(`Unsupported operator: ${node.op}`);
            }
            return process(res);
        }

        case 'ParenthesisNode':
            return evalNodeKDigit(node.content, scope, k, method);

        default:
            throw new Error(`Unsupported node type: ${node.type}`);
    }
}

function evaluateExpressionKDigit(expr, scope, k, method) {
    const node = math.parse(expr);
    return evalNodeKDigit(node, scope, k, method);
}
