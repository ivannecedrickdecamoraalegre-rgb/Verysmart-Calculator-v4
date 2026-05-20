function evalPolynomial(expr, scope) {
    try {
        return math.evaluate(expr, scope);
    } catch (err) {
        return 'Error: ' + err.message;
    }
}

function chopNums(p, k) {
    if (math.equal(p, 0)) return math.bignumber(0);

    const sign = math.sign(p);
    const abs = math.abs(p);
    const exponent = math.floor(math.log10(abs));
    const factor = math.pow(10, math.subtract(exponent, k - 1));
    const rescaled = math.floor(math.divide(abs, factor));
    const chopped = math.multiply(rescaled, factor);

    return math.multiply(sign, chopped);
}

function roundNums(p, k) {
    if (math.equal(p, 0)) return math.bignumber(0);

    const sign = math.sign(p);
    const abs = math.abs(p);
    const exponent = math.floor(math.log10(abs));
    const factor = math.pow(10, math.subtract(exponent, k - 1));
    const rescaled = math.round(math.divide(abs, factor));
    const rounded = math.multiply(rescaled, factor);

    return math.multiply(sign, rounded);
}

function absoluteError(p, pe) {
    return math.abs(math.subtract(p, pe));
}

function relativeError(p, pe) {
    if (math.equal(p, 0)) return math.bignumber(Infinity);
    return math.divide(absoluteError(p, pe), math.abs(p));
}

function maximumAbsoluteError(P, t, method) {
    if (math.equal(P, 0)) return math.bignumber(0);

    const absP = math.abs(P);
    const exponent = math.floor(math.log10(absP));
    const factor = math.pow(10, math.subtract(exponent, t - 1));

    return method === 'chop' ? factor : math.multiply(0.5, factor);
}

function buildSingleVariableFunction(expr) {
    const node = math.parse(expr);
    validateSingleVariableNode(node);
    const compiled = node.compile();

    return (x) => evaluateSingleVariableCompiled(compiled, x);
}

function buildSingleVariableDerivative(expr) {
    const node = math.parse(expr);
    validateSingleVariableNode(node);
    const derivativeNode = math.derivative(node, 'x');
    const compiled = derivativeNode.compile();

    return {
        expression: derivativeNode.toString(),
        evaluate: (x) => evaluateSingleVariableCompiled(compiled, x)
    };
}

function validateSingleVariableNode(node) {
    const symbols = new Set();

    node.traverse((child) => {
        if (child.type === 'SymbolNode') {
            symbols.add(child.name);
        }
    });

    const allowedBuiltIns = new Set([
        'abs', 'acos', 'asin', 'atan', 'cbrt', 'ceil', 'cos', 'cosh', 'cube',
        'e', 'exp', 'floor', 'ln', 'log', 'log10', 'max', 'min', 'pi', 'pow',
        'sin', 'sinh', 'sqrt', 'tan', 'tanh'
    ]);

    for (const symbol of symbols) {
        if (symbol !== 'x' && !allowedBuiltIns.has(symbol)) {
            throw new Error(`Unsupported symbol: ${symbol}. Use x as the variable.`);
        }
    }
}

function evaluateSingleVariableCompiled(compiled, x) {
    const scopedX = math.isBigNumber(x) ? x : math.bignumber(String(x));
    const value = compiled.evaluate({ x: scopedX });

    if (typeof value === 'number') {
        return value;
    }
    if (math.isBigNumber(value)) {
        return Number(value.toString());
    }

    return Number(value);
}

function clearTable(tableId) {
    document.getElementById(tableId).innerHTML = '';
}

function renderRows(tableId, rows, keys) {
    const tableBody = document.getElementById(tableId);
    tableBody.innerHTML = '';

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        keys.forEach((key) => {
            const td = document.createElement('td');
            td.textContent = row[key];
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}
