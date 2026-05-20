function formatValue(val, sigDigits, mode) {
    const num = Number(val);
    if (!Number.isFinite(num)) {
        return num;
    }

    if (!Number.isInteger(sigDigits) || sigDigits <= 0) {
        return num;
    }

    if (num === 0) {
        return 0;
    }

    const sign = Math.sign(num);
    const abs = Math.abs(num);
    const exponent = Math.floor(Math.log10(abs));
    const factor = Math.pow(10, sigDigits - 1 - exponent);
    const scaled = abs * factor;
    const processed = mode === 'chop' ? Math.trunc(scaled) : Math.round(scaled);

    return sign * processed / factor;
}

// BISECTION METHOD f: the function, a: start, b: end, sigs: digits, mode: 'round'/'chop', tol: tolerance
function runBisection(f, a, b, sigs, mode, tol, errorConstraint) {
    let iterationTable = [];
    let fa = f(a);
    let fb = f(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
        return { error: "Function must be finite at both interval endpoints." };
    }
    if (tol <= 0) {
        return { error: "Tolerance must be greater than zero." };
    }
    if (fa * fb >= 0) { //Checks if root exists or not
        return { error: "Signs are the same. No root guaranteed in this interval." };
    }
    if (errorConstraint !== undefined && errorConstraint <= 0) {
        return { error: "Error constraint must be greater than zero." };
    }
	let maxIterations = Math.ceil(Math.log2(Math.abs(b - a) / tol)); //checks how many interation for the system to load
    maxIterations = Math.max(1, Math.min(maxIterations + 100, 1000));
    let currentA = a;
    let currentB = b;
    let root = 0;
    let finalErrorBound = Infinity;
    for (let i = 1; i <= maxIterations; i++) {
	let mid = (currentA + currentB) / 2; //finding midpoint
        let rawFMid = f(mid);
        if (!Number.isFinite(rawFMid)) {
            return { error: "Function became non-finite during bisection.", table: iterationTable };
        }
        let fMid = formatValue(rawFMid, sigs, mode);
        let nextA = currentA;
        let nextB = currentB;
        if (rawFMid === 0) {
            nextA = mid;
            nextB = mid;
        } else if (f(currentA) * rawFMid < 0) {
            nextB = mid;
        } else {
            nextA = mid;
        }
        let width = Math.abs(nextB - nextA);
        let denominator = Math.abs(nextA);
        let errorBound = denominator === 0 ? Infinity : width / denominator;
        finalErrorBound = errorBound;
	iterationTable.push({
            iter: i,
            a: currentA,
            b: currentB,
            mid: mid,
            fMid: rawFMid,
            errorBound: errorBound
        });
        let toleranceMet = rawFMid === 0 || width / 2 < tol;
        let errorConstraintMet = errorConstraint === undefined || errorBound <= errorConstraint;
	if (toleranceMet && errorConstraintMet) {
            root = mid;
            break;
        }
        currentA = nextA;
        currentB = nextB;
        root = mid;
    }

    return {
        finalRoot: root,
        table: iterationTable,
        totalSteps: iterationTable.length,
        errorBound: finalErrorBound
    };
}

// NEWTONS METHOD f: function, derivative: f'(x), x0: initial guess, sigs: digits, mode: 'round'/'chop', stopVal: tolerance or iterations, stopType: 'tol' or 'iter'
function runNewton(f, derivative, x0, sigs, mode, stopVal, stopType) {
    let iterationTable = [];
    let x = x0;
    if (!Number.isFinite(x)) {
        return { error: "Initial guess must be finite." };
    }
    if (stopVal <= 0) {
        return { error: "Stopping value must be greater than zero." };
    }
    
    // If they chose 'iter', we run that many times. If 'tol', we set a safety limit of 100.
    let maxLoop = (stopType === 'iter') ? Math.floor(stopVal) : 100;
    maxLoop = Math.max(1, Math.min(maxLoop, 1000));

    for (let i = 0; i < maxLoop; i++) {
        let fx = f(x);
        if (!Number.isFinite(fx)) {
            return { error: "Function became non-finite during Newton iteration.", table: iterationTable };
        }
        if (stopType === 'tol' && Math.abs(fx) < stopVal) {
            break;
        }

        // Use the symbolic derivative so the table follows the classroom workflow.
        let slope = derivative(x);
		if (!Number.isFinite(slope) || Math.abs(slope) < Number.EPSILON) {
            return { error: "Slope is zero. The method cannot continue.", table: iterationTable };
        }

        // 2. The formula: nextX = x - f(x) / f'(x)
        let correction = fx / slope;
        let nextX = x - correction;
        iterationTable.push({
            iter: i + 1,
            x: formatValue(x, sigs, mode),
            fx: formatValue(fx, sigs, mode),
            derivative: formatValue(slope, sigs, mode),
            correction: formatValue(correction, sigs, mode),
            nextX: formatValue(nextX, sigs, mode)
        });

        x = nextX;
        if (!Number.isFinite(x)) {
            return { error: "Newton iteration produced a non-finite value.", table: iterationTable };
        }
    }

    iterationTable.push({
        iter: iterationTable.length + 1,
        x: formatValue(x, sigs, mode),
        fx: '',
        derivative: '',
        correction: '',
        nextX: ''
    });

    return {
        finalRoot: formatValue(x, sigs, mode),
        table: iterationTable
    };
}

// FIXED-POINT ITERATION f: original function, g: iteration function, x0: initial guess,
// sigs: digits, mode: 'round'/'chop', stopVal: tolerance or iterations, stopType: 'tol' or 'iter'
function runFixedPoint(f, g, x0, sigs, mode, stopVal, stopType) {
    let iterationTable = [];
    let x = x0;

    if (!Number.isFinite(x)) {
        return { error: "Initial guess must be finite." };
    }
    if (stopVal <= 0) {
        return { error: "Stopping value must be greater than zero." };
    }

    let maxLoop = (stopType === 'iter') ? Math.floor(stopVal) : 100;
    maxLoop = Math.max(1, Math.min(maxLoop, 1000));

    for (let i = 0; i < maxLoop; i++) {
        const gxRaw = g(x);
        if (!Number.isFinite(gxRaw)) {
            return { error: "g(x) became non-finite during fixed-point iteration.", table: iterationTable };
        }

        const nextX = formatValue(gxRaw, sigs, mode);
        const error = Math.abs(nextX - x);
        iterationTable.push({
            iter: i,
            x: formatValue(x, sigs, mode),
            gx: nextX,
            error: formatValue(error, sigs, mode)
        });

        if (stopType === 'tol' && error < stopVal) {
            return {
                finalRoot: nextX,
                table: iterationTable
            };
        }

        x = nextX;
    }

    const fx = f(x);
    if (!Number.isFinite(fx)) {
        return { error: "Function became non-finite while checking the fixed-point result.", table: iterationTable };
    }

    return {
        finalRoot: formatValue(x, sigs, mode),
        table: iterationTable
    };
}
