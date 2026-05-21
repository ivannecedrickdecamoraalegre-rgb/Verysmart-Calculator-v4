function initializeBinaryConversionCalculator() {
    document.getElementById('decToBinBtn').addEventListener('click', handleDecimalToBinary);
    document.getElementById('binToDecBtn').addEventListener('click', handleBinaryToDecimal);
}

function handleDecimalToBinary() {
    const decimalVal = parseFloat(document.getElementById('decimalInput').value);
    const mode = document.querySelector('input[name="binMode"]:checked').value;

    if (!Number.isFinite(decimalVal)) {
        alert('Please enter a valid decimal number');
        return;
    }

    const binaryValue = mode === 'plain'
        ? decimalToPlainBinary(decimalVal)
        : decimalToIEEE(decimalVal, mode);

    document.getElementById('binaryDecimalResult').value = decimalVal;
    document.getElementById('binaryBinaryResult').value = binaryValue;
    document.getElementById('binaryIEEEResult').value = mode === 'plain' ? 'Plain Binary' : mode.toUpperCase();
}

function handleBinaryToDecimal() {
    const binaryVal = document.getElementById('binaryInput').value.trim();
    const mode = document.querySelector('input[name="binMode"]:checked').value;

    if (!binaryVal) {
        alert('Please enter a binary value');
        return;
    }

    try {
        const result = convertBinaryInputToDecimal(binaryVal, mode);
        document.getElementById('binaryDecimalResult').value = result.decimalValue;
        document.getElementById('binaryBinaryResult').value = binaryVal;
        document.getElementById('binaryIEEEResult').value = result.description;
    } catch (err) {
        alert(err.message);
    }
}

function decimalToPlainBinary(decimalVal) {
    const intPart = Math.floor(Math.abs(decimalVal));
    const fracPart = Math.abs(decimalVal) - intPart;
    let binaryVal = intPart.toString(2);

    if (fracPart > 0) {
        binaryVal += '.';
        let frac = fracPart;
        for (let i = 0; i < 20 && frac > 0; i++) {
            frac *= 2;
            binaryVal += Math.floor(frac);
            frac -= Math.floor(frac);
        }
    }

    return decimalVal < 0 ? '-' + binaryVal : binaryVal;
}

function plainBinaryToDecimal(binStr) {
    const isNegative = binStr.startsWith('-');
    const unsignedBin = isNegative ? binStr.slice(1) : binStr;

    if (!/^[01]+(\.[01]+)?$/.test(unsignedBin)) throw new Error('Invalid plain binary');

    const [intPart, fracPart] = unsignedBin.split('.');
    let decimalValue = intPart ? parseInt(intPart, 2) : 0;

    if (fracPart) {
        for (let i = 0; i < fracPart.length; i++) {
            if (fracPart[i] === '1') {
                decimalValue += Math.pow(2, -(i + 1));
            }
        }
    }

    return isNegative ? -decimalValue : decimalValue;
}

function decimalToIEEE(val, mode) {
    const buffer = new ArrayBuffer(mode === 'ieee32' ? 4 : 8);
    const view = new DataView(buffer);

    if (mode === 'ieee32') {
        view.setFloat32(0, val, false);
    } else {
        view.setFloat64(0, val, false);
    }

    let binaryStr = '';
    const bytes = mode === 'ieee32' ? 4 : 8;

    for (let i = 0; i < bytes; i++) {
        binaryStr += view.getUint8(i).toString(2).padStart(8, '0');
    }

    return binaryStr;
}

function binaryToIEEE(bin, mode) {
    const expLen = mode === 'ieee32' ? 8 : 11;
    const bias = mode === 'ieee32' ? 127 : 1023;
    const sign = bin[0] === '1' ? -1 : 1;
    const exponentRaw = bin.slice(1, 1 + expLen);
    const fractionRaw = bin.slice(1 + expLen);
    const exponentInt = parseInt(exponentRaw, 2);

    if (exponentInt === 0) {
        let fraction = 0;
        for (let i = 0; i < fractionRaw.length; i++) {
            if (fractionRaw[i] === '1') {
                fraction += Math.pow(2, -(i + 1));
            }
        }
        return sign * fraction * Math.pow(2, 1 - bias);
    }

    if (exponentInt === Math.pow(2, expLen) - 1) {
        return fractionRaw.includes('1') ? NaN : sign * Infinity;
    }

    let fraction = 1;
    for (let i = 0; i < fractionRaw.length; i++) {
        if (fractionRaw[i] === '1') {
            fraction += Math.pow(2, -(i + 1));
        }
    }

    return sign * fraction * Math.pow(2, exponentInt - bias);
}

function convertBinaryInputToDecimal(binaryVal, mode) {
    if (mode === 'plain') {
        return {
            decimalValue: plainBinaryToDecimal(binaryVal),
            description: 'Plain Binary'
        };
    }

    const bitCount = mode === 'ieee32' ? 32 : 64;
    const normalized = binaryVal.replace(/\s+/g, '');

    if (!/^[01]+$/.test(normalized)) {
        throw new Error('IEEE input must contain only 0 and 1.');
    }
    if (normalized.length !== bitCount) {
        throw new Error(`Please enter exactly ${bitCount} bits (Current: ${normalized.length})`);
    }

    const expBits = mode === 'ieee32' ? normalized.slice(1, 9) : normalized.slice(1, 12);
    return {
        decimalValue: binaryToIEEE(normalized, mode),
        description: `Sign: ${normalized[0]} | Exp: ${expBits} | Mode: ${mode.toUpperCase()}`
    };
}
