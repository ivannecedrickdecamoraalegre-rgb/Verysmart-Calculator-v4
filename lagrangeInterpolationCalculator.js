function initializeInterpolationCalculator() {
    console.log('initializeInterpolationCalculator called');
    document.getElementById('runInterpolationBtn').addEventListener('click', handleRunInterpolation);

    const interpolationMethod = document.getElementById('interpolationMethod');
    const lagrangeFormBlock = document.getElementById('lagrangeFormBlock');
    const modePoints = document.getElementById('modePoints');
    const modeFunction = document.getElementById('modeFunction');

    function toggleInputs() {
        const useFunction = modeFunction.checked;
        const useLagrange = interpolationMethod.value === 'lagrange';

        document.getElementById('pointsInputBlock').style.display = useFunction ? 'none' : '';
        document.getElementById('functionInputBlock').style.display = useFunction ? '' : 'none';
        lagrangeFormBlock.style.display = useLagrange ? '' : 'none';
    }

    modePoints.addEventListener('change', toggleInputs);
    modeFunction.addEventListener('change', toggleInputs);
    interpolationMethod.addEventListener('change', toggleInputs);
    toggleInputs();
}

// Safety: expose handler on window so HTML onclick or manual calls can trigger it
window.handleRunInterpolation = handleRunInterpolation;

function handleRunInterpolation() {
    console.log('handleRunInterpolation: started');
    const method = document.getElementById('interpolationMethod').value;
    const mode = document.querySelector('input[name="interpMode"]:checked').value;
    const polynomialResult = document.getElementById('interpolationPolynomialResult');
    const valueResult = document.getElementById('interpolationValueResult');
    const extraResult = document.getElementById('interpolationExtraInfo');
    const xEvalInput = document.getElementById('interpXValue').value.trim();

    polynomialResult.value = '';
    valueResult.value = '';
    extraResult.value = '';

    try {
        let points = null;
        const lagrangeForm = document.getElementById('lagrangeForm').value;
        console.log('mode:', mode, 'method:', method, 'lagrangeForm:', lagrangeForm);

        if (mode === 'points') {
            const pointsInput = document.getElementById('lagrangePoints').value.trim();
            if (!pointsInput) throw new Error('Please enter at least two data points.');
            points = parsePoints(pointsInput);
            console.log('parsed points:', points);
        } else {
            const nodesInput = document.getElementById('nodesInput').value.trim();
            const funcInput = document.getElementById('functionInput').value.trim();
            console.log('nodesInput:', nodesInput, 'funcInput:', funcInput);
            if (!nodesInput || !funcInput) throw new Error('Please enter nodes and a function when using Nodes + Function mode.');
            const nodes = parseNodes(nodesInput);
            const useFractionNodes = nodes.some((n) => math.isFraction(n));
            const f = buildSingleVariableFunction(sanitizeExpression(funcInput, useFractionNodes));
            points = nodes.map((xn) => {
                const yVal = f(xn);
                const yValFrac = math.isFraction(yVal)
                    ? yVal
                    : math.isBigNumber(yVal)
                        ? math.fraction(yVal.toString())
                        : math.fraction(String(yVal));
                const p = { x: xn, y: yValFrac };
                console.log('node point', p);
                return p;
            });
        }

        let resultObj = null;
        if (method === 'lagrange') {
            resultObj = buildLagrangePolynomial(points);
        } else if (method === 'newton') {
            resultObj = buildNewtonPolynomial(points);
            extraResult.value = `Coefficients: ${resultObj.coefficients.map((c) => c.toString()).join(', ')}`;
        } else if (method === 'neville') {
            resultObj = buildNevillePolynomial(points);
            extraResult.value = `Neville interpolation of degree ${resultObj.degree}`;
        }
        polynomialResult.value = resultObj.expression || (method + ' (see extra info)');
        extraResult.value = resultObj.extraInfo || '';

        if (xEvalInput !== '') {
            const xVal = Number(xEvalInput);
            if (!Number.isFinite(xVal)) throw new Error('Please enter a valid x value to evaluate.');
            const val = resultObj.evaluate(xVal);
            console.log('evaluated value at', xVal, ':', val);
            valueResult.value = formatEvaluatedValue(val);
        }
    } catch (err) {
        console.error('handleRunInterpolation error', err);
        alert(err.message);
    }
}

function formatEvaluatedValue(value) {
    if (math.isFraction(value) || math.isBigNumber(value)) {
        const numberValue = math.number(value);
        if (Number.isInteger(numberValue)) {
            return numberValue.toString();
        }
        return numberValue.toFixed(5).replace(/\.0+$|(?<=\d)0+$/, '');
    }
    return String(value);
}

function parsePoints(input) {
    const pairs = input.split(';').map((p) => p.trim()).filter(Boolean);
    if (pairs.length < 2) throw new Error('Please enter at least two points separated by semicolons.');

    const points = pairs.map((pair) => {
        const values = pair.split(',').map((v) => v.trim());
        if (values.length !== 2) throw new Error('Each point must be in x,y format.');
        const x = Number(values[0]);
        const y = Number(values[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Each point must contain valid numeric x and y values.');
        return { x: math.bignumber(x), y: math.bignumber(y) };
    });

    const uniqueX = new Set(points.map((p) => p.x.toString()));
    if (uniqueX.size !== points.length) throw new Error('All x-values must be distinct for interpolation.');

    return points;
}

function parseNodes(input) {
    return input.split(/[;,]/).map((s) => s.trim()).filter(Boolean).map((v) => {
        try {
            return math.fraction(String(v));
        } catch (err) {
            throw new Error('Invalid node value: ' + v);
        }
    });
}

function formatMathObject(value) {
    if (math.isFraction(value) || math.isBigNumber(value)) {
        return value.toString();
    }
    return String(value);
}

function sanitizeExpression(expr, useFraction = false) {
    // Parse expression to an AST and replace numeric constants with
    // bignumber('...') or fraction('...') calls to avoid implicit
    // conversion errors in math.js when compiling.
    const wrapper = useFraction ? 'fraction' : 'bignumber';
    try {
        const node = math.parse(expr);
        const transformed = node.transform(function (child) {
            if (!child.isConstantNode) return child;

            // handle JS numbers, BigNumber, and Fraction constant nodes
            const val = child.value;
            if (typeof val === 'number' || math.isBigNumber(val) || math.isFraction(val)) {
                return math.parse(`${wrapper}('${val.toString()}')`);
            }

            return child;
        });
        return transformed.toString();
    } catch (err) {
        // Fallback: wrap long decimals only
        if (useFraction) {
            return expr.replace(/(-?\d+\.?\d*)/g, (m) => `fraction('${m}')`);
        }
        return expr.replace(/(-?\d+\.\d{16,})/g, (m) => `bignumber('${m}')`);
    }
}

function buildLagrangePolynomial(points) {
    const useFraction = points.some((p) => math.isFraction(p.x) || math.isFraction(p.y));

    // normalize all point types when using fractions
    if (useFraction) {
        points = points.map((p) => ({
            x: math.isFraction(p.x) ? p.x : math.fraction(p.x.toString()),
            y: math.isFraction(p.y) ? p.y : math.fraction(p.y.toString())
        }));
    }

    const n = points.length;
    const zero = coerceValue(0, useFraction);
    let polynomial = Array(n).fill(zero);

    for (let i = 0; i < n; i++) {
        let denom = coerceValue(1, useFraction);
        let basis = [coerceValue(1, useFraction)];

        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            denom = math.multiply(denom, math.subtract(points[i].x, points[j].x));
            basis = multiplyPolynomials(basis, [math.subtract(zero, points[j].x), coerceValue(1, useFraction)], zero, useFraction);
        }

        const scalar = math.divide(points[i].y, denom);
        const termPoly = scalePolynomial(basis, scalar, useFraction);
        polynomial = addPolynomials(polynomial, termPoly, zero, useFraction);
    }

    const expression = polynomialToString(polynomial, useFraction);
    return {
        expression,
        coefficients: polynomial,
        evaluate: (xValue) => evaluatePolynomial(polynomial, xValue, useFraction)
    };
}

function coerceValue(value, useFraction) {
    if (useFraction) {
        if (math.isFraction(value)) return value;
        return math.fraction(value.toString());
    }
    if (math.isBigNumber(value)) return value;
    if (math.isFraction(value)) return math.bignumber(value.toString());
    return math.bignumber(String(value));
}

function addPolynomials(a, b, zero, useFraction) {
    const length = Math.max(a.length, b.length);
    const result = Array(length).fill(zero);
    for (let i = 0; i < length; i++) {
        const aCoef = i < a.length ? coerceValue(a[i], useFraction) : zero;
        const bCoef = i < b.length ? coerceValue(b[i], useFraction) : zero;
        result[i] = math.add(aCoef, bCoef);
    }
    return result;
}

function scalePolynomial(poly, scalar, useFraction) {
    return poly.map((coef) => math.multiply(coerceValue(coef, useFraction), coerceValue(scalar, useFraction)));
}

function multiplyPolynomials(a, b, zero, useFraction) {
    const result = Array(a.length + b.length - 1).fill(zero);
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            const idx = i + j;
            const product = math.multiply(coerceValue(a[i], useFraction), coerceValue(b[j], useFraction));
            result[idx] = math.add(result[idx], product);
        }
    }
    return result;
}

function evaluatePolynomial(coefs, xValue, useFraction) {
    const xArg = coerceValue(xValue, useFraction);
    let result = coerceValue(0, useFraction);
    let power = coerceValue(1, useFraction);

    for (let i = 0; i < coefs.length; i++) {
        result = math.add(result, math.multiply(coerceValue(coefs[i], useFraction), power));
        power = math.multiply(power, xArg);
    }
    return result;
}

function polynomialToString(coefs, useFraction) {
    const terms = [];
    const one = coerceValue(1, useFraction);
    const zero = coerceValue(0, useFraction);

    for (let i = coefs.length - 1; i >= 0; i--) {
        const coef = coerceValue(coefs[i], useFraction);
        if (math.equal(coef, zero)) continue;

        const isNegative = math.smaller(coef, zero);
        const absCoef = isNegative ? math.abs(coef) : coef;
        const coefStr = formatCoefficient(absCoef, useFraction);
        const degree = i;

        let term;
        if (degree === 0) {
            term = coefStr;
        } else {
            const isOne = math.equal(absCoef, one);
            const varPart = degree === 1 ? 'x' : `x^${degree}`;
            term = isOne ? varPart : `${coefStr}${varPart}`;
        }

        if (terms.length === 0) {
            terms.push(isNegative ? `-${term}` : term);
        } else {
            terms.push(isNegative ? `- ${term}` : `+ ${term}`);
        }
    }

    return terms.length ? terms.join(' ') : '0';
}

function formatCoefficient(coef, useFraction) {
    if (useFraction && math.isFraction(coef)) {
        const numerator = coef.n.toString();
        const denominator = coef.d.toString();
        return coef.d === 1 ? numerator : `${numerator}/${denominator}`;
    }
    if (useFraction && math.isBigNumber(coef)) {
        return math.fraction(coef.toString()).toString();
    }
    return coef.toString();
}

function buildNewtonPolynomial(points) {
    const n = points.length;
    const useFraction = points.some((p) => math.isFraction(p.x) || math.isFraction(p.y));

    if (useFraction) {
        points = points.map((p) => ({
            x: math.isFraction(p.x) ? p.x : math.fraction(p.x.toString()),
            y: math.isFraction(p.y) ? p.y : math.fraction(p.y.toString())
        }));
    }

    const zero = useFraction ? math.fraction(0) : math.bignumber(0);
    const table = Array.from({ length: n }, () => Array(n).fill(zero));
    for (let i = 0; i < n; i++) table[i][0] = points[i].y;

    for (let j = 1; j < n; j++) {
        for (let i = 0; i < n - j; i++) {
            const num = math.subtract(table[i + 1][j - 1], table[i][j - 1]);
            const den = math.subtract(points[i + j].x, points[i].x);
            table[i][j] = math.divide(num, den);
        }
    }

    const coefficients = Array(n).fill(zero);
    for (let i = 0; i < n; i++) coefficients[i] = table[0][i];

    // build expression a0 + a1*(x-x0) + a2*(x-x0)*(x-x1) + ...
    const terms = [];
    for (let k = 0; k < n; k++) {
        const a = coefficients[k];
        if (k === 0) {
            terms.push(`(${a.toString()})`);
        } else {
            const factors = [];
            for (let t = 0; t < k; t++) factors.push(formatLagrangeFactor(points[t].x));
            terms.push(`(${a.toString()}) * (${factors.join(' * ')})`);
        }
    }

    const expression = terms.join(' + ');
    const compiled = math.compile(sanitizeExpression(expression, useFraction));

    return {
        expression,
        coefficients: coefficients.map((c) => c),
        extraInfo: `Coefficients: ${coefficients.map((c) => c.toString()).join(', ')}`,
        evaluate: (xValue) => {
            const xArg = useFraction ? math.fraction(String(xValue)) : math.bignumber(xValue);
            return compiled.evaluate({ x: xArg });
        }
    };
}

function formatLagrangeFactor(xValue) {
    if (math.equal(xValue, 0)) return '(x)';
    return math.larger(xValue, 0) ? `(x - ${xValue.toString()})` : `(x + ${math.abs(xValue).toString()})`;
}

function buildNevillePolynomial(points) {
    const n = points.length;
    const useFraction = points.some((p) => math.isFraction(p.x) || math.isFraction(p.y));
    if (useFraction) {
        points = points.map((p) => ({
            x: math.isFraction(p.x) ? p.x : math.fraction(p.x.toString()),
            y: math.isFraction(p.y) ? p.y : math.fraction(p.y.toString())
        }));
    }

    const exprTable = Array.from({ length: n }, () => Array(n).fill(''));

    for (let i = 0; i < n; i++) {
        exprTable[i][0] = `(${points[i].y.toString()})`;
    }

    for (let j = 1; j < n; j++) {
        for (let i = 0; i < n - j; i++) {
            const x_i = points[i].x;
            const x_ij = points[i + j].x;
            const denom = math.subtract(x_i, x_ij);
            exprTable[i][j] = `((x - ${x_ij.toString()}) * (${exprTable[i][j - 1]}) - (x - ${x_i.toString()}) * (${exprTable[i + 1][j - 1]})) / (${denom.toString()})`;
        }
    }

    const expression = exprTable[0][n - 1];
    const compiled = math.compile(sanitizeExpression(expression, useFraction));

    return {
        expression,
        degree: n - 1,
        extraInfo: `Neville interpolation of degree ${n - 1}`,
        evaluate: (xValue) => {
            const xArg = useFraction ? math.fraction(String(xValue)) : math.bignumber(xValue);
            return compiled.evaluate({ x: xArg });
        }
    };
}
