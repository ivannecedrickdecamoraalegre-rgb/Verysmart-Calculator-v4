function initializeRootFindingCalculators() {
    attachIfPresent('runBisectionBtn', handleRunBisection);
    attachIfPresent('runNewtonBtn', handleRunNewton);
    attachIfPresent('runFixedPointBtn', handleRunFixedPoint);
}

function handleRunBisection() {
    let settings;
    try {
        settings = getRootFindingSettings();
    } catch (err) {
        showMethodError(err.message, 'bisectionRoot', 'bisectionSteps', 'bisectionTable');
        return;
    }

    const a = parseFloat(document.getElementById('bisectionA').value);
    const b = parseFloat(document.getElementById('bisectionB').value);
    const tol = parseFloat(document.getElementById('bisectionTolerance').value);
    const rawErrorConstraint = document.getElementById('bisectionErrorConstraint').value.trim();
    const errorConstraint = rawErrorConstraint === '' ? undefined : parseFloat(rawErrorConstraint);

    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
        showMethodError('Please enter two different finite endpoints.', 'bisectionRoot', 'bisectionSteps', 'bisectionTable');
        return;
    }
    if (!Number.isFinite(tol) || tol <= 0) {
        showMethodError('Please enter a positive tolerance.', 'bisectionRoot', 'bisectionSteps', 'bisectionTable');
        return;
    }
    if (errorConstraint !== undefined && (!Number.isFinite(errorConstraint) || errorConstraint <= 0)) {
        showMethodError('Please enter a positive error constraint.', 'bisectionRoot', 'bisectionSteps', 'bisectionTable');
        return;
    }

    const methodResult = runBisection(
        settings.f,
        Math.min(a, b),
        Math.max(a, b),
        settings.sigs,
        settings.mode,
        tol,
        errorConstraint
    );

    displayMethodResult(methodResult, 'bisectionRoot', 'bisectionSteps', 'bisectionTable', ['iter', 'a', 'b', 'mid', 'fMid', 'errorBound']);
    document.getElementById('bisectionErrorBound').value = methodResult.errorBound !== undefined ? methodResult.errorBound : '';
}

function handleRunNewton() {
    let settings;
    try {
        settings = getRootFindingSettings();
    } catch (err) {
        showMethodError(err.message, 'newtonRoot', 'newtonSteps', 'newtonTable');
        return;
    }

    const x0 = parseFloat(document.getElementById('newtonInitial').value);
    const stopVal = parseFloat(document.getElementById('newtonStopValue').value);
    const stopType = normalizeStopType(document.getElementById('newtonStopType').value);

    if (!Number.isFinite(x0)) {
        showMethodError('Please enter a finite initial guess.', 'newtonRoot', 'newtonSteps', 'newtonTable');
        return;
    }
    if (!Number.isFinite(stopVal) || stopVal <= 0) {
        showMethodError('Please enter a positive stopping value.', 'newtonRoot', 'newtonSteps', 'newtonTable');
        return;
    }
    if (stopType === 'iter' && !Number.isInteger(stopVal)) {
        showMethodError('Iterations must be a whole number.', 'newtonRoot', 'newtonSteps', 'newtonTable');
        return;
    }

    const methodResult = runNewton(settings.f, settings.derivative.evaluate, x0, settings.sigs, settings.mode, stopVal, stopType);
    displayMethodResult(methodResult, 'newtonRoot', 'newtonSteps', 'newtonTable', ['iter', 'x', 'fx', 'derivative', 'correction', 'nextX']);
}

function handleRunFixedPoint() {
    let settings;
    try {
        settings = getRootFindingSettings();
    } catch (err) {
        showMethodError(err.message, 'fixedPointRoot', 'fixedPointSteps', 'fixedPointTable');
        return;
    }

    const gExpr = document.getElementById('fixedPointFunction').value.trim();
    const x0 = parseFloat(document.getElementById('fixedPointInitial').value);
    const stopVal = parseFloat(document.getElementById('fixedPointStopValue').value);
    const stopType = normalizeStopType(document.getElementById('fixedPointStopType').value);

    if (!gExpr) {
        showMethodError('Please enter an iteration function g(x).', 'fixedPointRoot', 'fixedPointSteps', 'fixedPointTable');
        return;
    }
    if (!Number.isFinite(x0)) {
        showMethodError('Please enter a finite initial guess.', 'fixedPointRoot', 'fixedPointSteps', 'fixedPointTable');
        return;
    }
    if (!Number.isFinite(stopVal) || stopVal <= 0) {
        showMethodError('Please enter a positive stopping value.', 'fixedPointRoot', 'fixedPointSteps', 'fixedPointTable');
        return;
    }
    if (stopType === 'iter' && !Number.isInteger(stopVal)) {
        showMethodError('Iterations must be a whole number.', 'fixedPointRoot', 'fixedPointSteps', 'fixedPointTable');
        return;
    }

    let g;
    try {
        g = buildSingleVariableFunction(gExpr);
    } catch (err) {
        showMethodError(err.message, 'fixedPointRoot', 'fixedPointSteps', 'fixedPointTable');
        return;
    }

    const methodResult = runFixedPoint(settings.f, g, x0, settings.sigs, settings.mode, stopVal, stopType);
    displayMethodResult(methodResult, 'fixedPointRoot', 'fixedPointSteps', 'fixedPointTable', ['iter', 'x', 'gx', 'error']);
}

function getRootFindingSettings() {
    const expr = document.getElementById('rootFunction').value.trim();
    const sigs = parseInt(document.getElementById('rootSigDigits').value);
    const mode = document.querySelector('input[name="rootMethod"]:checked').value;

    if (!expr) {
        throw new Error('Please enter a function f(x).');
    }
    if (isNaN(sigs) || sigs <= 0) {
        throw new Error('Please enter a positive number of significant digits.');
    }

    return {
        expr,
        f: buildSingleVariableFunction(expr),
        derivative: buildSingleVariableDerivative(expr),
        sigs,
        mode
    };
}

function normalizeStopType(stopType) {
    const normalized = String(stopType).trim().toLowerCase();

    if (normalized === 'tol' || normalized === 'tolerance') {
        return 'tol';
    }
    if (normalized === 'iter' || normalized === 'iteration' || normalized === 'iterations') {
        return 'iter';
    }

    return normalized;
}

function attachIfPresent(id, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', handler);
    }
}

function showMethodError(message, rootId, stepsId, tableId) {
    document.getElementById(rootId).value = message;
    document.getElementById(stepsId).value = '';
    clearTable(tableId);
    if (rootId === 'bisectionRoot') {
        document.getElementById('bisectionErrorBound').value = '';
    }
}

function displayMethodResult(methodResult, rootId, stepsId, tableId, keys) {
    document.getElementById(rootId).value = methodResult.error || methodResult.finalRoot;
    document.getElementById(stepsId).value = methodResult.table ? methodResult.table.length : '';
    renderRows(tableId, methodResult.table || [], keys);
}
