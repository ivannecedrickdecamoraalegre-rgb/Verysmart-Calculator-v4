function initializeInterpolationCalculator() {
    document.getElementById('runInterpolationBtn').addEventListener('click', handleRunInterpolation);

    const interpolationMethod = document.getElementById('interpolationMethod');
    const modePoints = document.getElementById('modePoints');
    const modeFunction = document.getElementById('modeFunction');

    function toggleInputs() {
        const useFunction = modeFunction.checked;

        document.getElementById('pointsInputBlock').style.display = useFunction ? 'none' : '';
        document.getElementById('functionInputBlock').style.display = useFunction ? '' : 'none';
    }

    modePoints.addEventListener('change', toggleInputs);
    modeFunction.addEventListener('change', toggleInputs);
    interpolationMethod.addEventListener('change', toggleInputs);
    toggleInputs();
}

function handleRunInterpolation() {
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

        if (mode === 'points') {
            const pointsInput = document.getElementById('lagrangePoints').value.trim();
            if (!pointsInput) throw new Error('Please enter at least two data points.');
            points = parsePoints(pointsInput);
        } else {
            const nodesInput = document.getElementById('nodesInput').value.trim();
            const funcInput = document.getElementById('functionInput').value.trim();
            if (!nodesInput || !funcInput) throw new Error('Please enter nodes and a function when using Nodes + Function mode.');
            const nodes = parseNodes(nodesInput);
            const f = buildSingleVariableFunction(funcInput);
            points = nodes.map((xn) => ({ x: math.bignumber(xn), y: math.bignumber(f(xn)) }));
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

        if (xEvalInput !== '') {
            const xVal = Number(xEvalInput);
            if (!Number.isFinite(xVal)) throw new Error('Please enter a valid x value to evaluate.');
            const val = resultObj.evaluate(xVal);
            valueResult.value = Number(val).toString();
        }
    } catch (err) {
        alert(err.message);
    }
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
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error('Invalid node value: ' + v);
        return n;
    });
}

function buildLagrangePolynomial(points) {
    // reuse existing Lagrange builder logic
    const terms = points.map((point, i) => {
        let denominator = math.bignumber(1);
        const numeratorFactors = [];

        points.forEach((otherPoint, j) => {
            if (i === j) return;
            denominator = math.multiply(denominator, math.subtract(point.x, otherPoint.x));
            numeratorFactors.push(formatLagrangeFactor(otherPoint.x));
        });

        const numerator = numeratorFactors.length ? numeratorFactors.join(' * ') : '1';
        return `(${point.y.toString()}) * (${numerator}) / (${denominator.toString()})`;
    });

    const expression = math.simplify(terms.join(' + ')).toString();
    const compiled = math.compile(expression);

    return {
        expression,
        evaluate: (xValue) => compiled.evaluate({ x: math.bignumber(xValue) })
    };
}

function buildNewtonPolynomial(points) {
    const n = points.length;
    // construct divided difference table using BigNumber
    const table = Array.from({ length: n }, () => Array(n).fill(math.bignumber(0)));
    for (let i = 0; i < n; i++) table[i][0] = points[i].y;

    for (let j = 1; j < n; j++) {
        for (let i = 0; i < n - j; i++) {
            const num = math.subtract(table[i + 1][j - 1], table[i][j - 1]);
            const den = math.subtract(points[i + j].x, points[i].x);
            table[i][j] = math.divide(num, den);
        }
    }

    const coefficients = Array(n).fill(math.bignumber(0));
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

    const expression = math.simplify(terms.join(' + ')).toString();
    const compiled = math.compile(expression);

    return {
        expression,
        coefficients: coefficients.map((c) => c),
        evaluate: (xValue) => compiled.evaluate({ x: math.bignumber(xValue) })
    };
}

function formatLagrangeFactor(xValue) {
    if (math.equal(xValue, 0)) return '(x)';
    return math.larger(xValue, 0) ? `(x - ${xValue.toString()})` : `(x + ${math.abs(xValue).toString()})`;
}

function buildNevillePolynomial(points) {
    const n = points.length;
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

    const expression = math.simplify(exprTable[0][n - 1]).toString();
    const compiled = math.compile(expression);

    return {
        expression,
        degree: n - 1,
        evaluate: (xValue) => compiled.evaluate({ x: math.bignumber(xValue) })
    };
}
