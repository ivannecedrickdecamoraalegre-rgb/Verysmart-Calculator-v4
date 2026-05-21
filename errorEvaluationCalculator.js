function initializeErrorEvaluationCalculator() {
    document.getElementById('extraBtn').addEventListener('click', handleEvaluateExtraErrors);
}

function handleEvaluateExtraErrors() {
    let pVal;
    let pStarVal;
    try {
        pVal = math.bignumber(document.getElementById('pValue').value);
        pStarVal = math.bignumber(document.getElementById('pStarValue').value);
    } catch (e) {
        alert('Please enter valid numbers for P and P*');
        return;
    }

    const sigDigits = parseInt(document.getElementById('extraSignificantDigits').value);
    if (isNaN(sigDigits) || sigDigits <= 0) {
        alert('Please enter a positive number of significant digits');
        return;
    }

    const errors = calculateApproximationErrors(pVal, pStarVal, sigDigits);
    displayExtraErrorResults(pStarVal, sigDigits, errors);
}

function calculateApproximationErrors(pVal, pStarVal, sigDigits) {
    const absErr = absoluteError(pVal, pStarVal);
    const relErr = relativeError(pVal, pStarVal);
    const maxErr = maximumAbsoluteError(pVal, sigDigits, 'round');

    return { absErr, relErr, maxErr };
}

function displayExtraErrorResults(pStarVal, sigDigits, errors) {
    document.getElementById('extraPStar').value = pStarVal.toString();
    document.getElementById('extraAbsoluteError').value = errors.absErr.toString();
    document.getElementById('extraRelativeError').value = errors.relErr.toExponential(4);
    document.getElementById('extraMaximumError').value = errors.maxErr.toExponential(4);
    document.getElementById('extraSignificantDigitsResult').value = sigDigits;
}
