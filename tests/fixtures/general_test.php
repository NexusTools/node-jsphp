<?php
// Function definition
function calculate_sum($a, $b) {
    return $a + $b;
}

// Class definition
class TestCalculator {
    public function multiply($x, $y) {
        return $x * $y;
    }
}

// Execution and verification
$calc = new TestCalculator();
$sumResult = calculate_sum(15, 25);
$multResult = $calc->multiply(6, 7);

echo "METHOD: " . ($_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN') . "\n";
echo "SUM: " . $sumResult . "\n";
echo "MULT: " . $multResult . "\n";
echo "QUERY_A: " . ($_GET['a'] ?? 'NONE') . "\n";
echo "STATUS: SUCCESS\n";
