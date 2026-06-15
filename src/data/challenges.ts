export interface TestCase {
  id: number;
  input: any[];
  expectedOutput: any;
  isHidden?: boolean;
}

export interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Advanced' | 'Expert';
  description: string;
  boilerplate: {
    javascript: string;
    python: string;
    javascriptDriver?: string;
    pythonDriver?: string;
    functionParams?: string;
    javascriptSolution?: string;
    pythonSolution?: string;
  };
  testCases: TestCase[];
  functionName: string;
  isMcq?: boolean;
  mcqOptions?: string[];
  mcqAnswer?: string;
  tags?: string[];
}

export const challenges: Challenge[] = [
  {
    id: 'mcq-complexity',
    title: 'Complexity: Binary Search Tree',
    category: 'Data Structures',
    difficulty: 'Easy',
    functionName: 'mcq',
    description: 'What is the worst-case time complexity of searching for an element in a Balanced Binary Search Tree (BST)?',
    boilerplate: {
      javascript: '',
      python: ''
    },
    testCases: [],
    isMcq: true,
    mcqOptions: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
    mcqAnswer: 'O(log N)',
    tags: ['data-structures']
  },
  {
    id: 'mcq-ordering',
    title: 'Ordering: LIFO Structure',
    category: 'Data Structures',
    difficulty: 'Easy',
    functionName: 'mcq',
    description: 'Which of the following data structures operates on a Last-In, First-Out (LIFO) basis?',
    boilerplate: {
      javascript: '',
      python: ''
    },
    testCases: [],
    isMcq: true,
    mcqOptions: ['Queue', 'Stack', 'Heap', 'Hash Table'],
    mcqAnswer: 'Stack',
    tags: ['data-structures']
  },
  {
    id: 'two-sum',
    title: 'Two Sum',
    category: 'Arrays',
    difficulty: 'Easy',
    functionName: 'twoSum',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have ***exactly* one solution**, and you may not use the *same* element twice.

You can return the answer in any order.

### Example 1:
**Input:** \`nums = [2,7,11,15]\`, \`target = 9\`  
**Output:** \`[0,1]\`  
**Explanation:** Because \`nums[0] + nums[1] == 9\`, we return \`[0, 1]\`.

### Example 2:
**Input:** \`nums = [3,2,4]\`, \`target = 6\`  
**Output:** \`[1,2]\`

### Example 3:
**Input:** \`nums = [3,3]\`, \`target = 6\`  
**Output:** \`[0,1]\`
`,
    boilerplate: {
      javascript: `function twoSum(nums, target) {
  // Write your code here
  
}`,
      python: `def twoSum(nums, target):
    # Write your code here
    pass`,
      pythonSolution: `def twoSum(nums, target):
    lookup = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in lookup:
            return [lookup[diff], i]
        lookup[num] = i
    return []`
    },
    testCases: [
      { id: 1, input: [[2, 7, 11, 15], 9], expectedOutput: [0, 1] },
      { id: 2, input: [[3, 2, 4], 6], expectedOutput: [1, 2] },
      { id: 3, input: [[3, 3], 6], expectedOutput: [0, 1] },
      { id: 4, input: [[1, 5, 8, 12, 14], 20], expectedOutput: [2, 3], isHidden: true },
      { id: 5, input: [[-1, -2, -3, -4, -5], -8], expectedOutput: [2, 4], isHidden: true }
    ],
    tags: ['arrays']
  },
  {
    id: 'reverse-string',
    title: 'Reverse String',
    category: 'Strings',
    difficulty: 'Easy',
    functionName: 'reverseString',
    description: `Write a function that reverses a string. The input string is given as a string \`s\`.

You must solve this returning the reversed string.

### Example 1:
**Input:** \`s = "hello"\`  
**Output:** \`"olleh"\`

### Example 2:
**Input:** \`s = "Hannah"\`  
**Output:** \`"hannaH"\`
`,
    boilerplate: {
      javascript: `function reverseString(s) {
  // Write your code here
  
}`,
      python: `def reverseString(s):
    # Write your code here
    pass`,
      pythonSolution: `def reverseString(s):
    return s[::-1]`
    },
    testCases: [
      { id: 1, input: ['hello'], expectedOutput: 'olleh' },
      { id: 2, input: ['Hannah'], expectedOutput: 'hannaH' },
      { id: 3, input: ['A'], expectedOutput: 'A' },
      { id: 4, input: ['DevEval Coding Platform'], expectedOutput: 'mrofta lP gnidoC laveveD', isHidden: true },
      { id: 5, input: [''], expectedOutput: '', isHidden: true }
    ],
    tags: ['strings']
  },
  {
    id: 'palindrome-number',
    title: 'Palindrome Number',
    category: 'Math',
    difficulty: 'Easy',
    functionName: 'isPalindrome',
    description: `Given an integer \`x\`, return \`true\` *if \`x\` is a palindrome*, and \`false\` *otherwise*.

An integer is a **palindrome** when it reads the same backward as forward. For example, \`121\` is a palindrome while \`123\` is not.

### Example 1:
**Input:** \`x = 121\`  
**Output:** \`true\`

### Example 2:
**Input:** \`x = -121\`  
**Output:** \`false\`  
**Explanation:** From left to right, it reads \`-121\`. From right to left, it becomes \`121-\`. Therefore it is not a palindrome.

### Example 3:
**Input:** \`x = 10\`  
**Output:** \`false\`  
**Explanation:** Reads \`01\` from right to left. Therefore it is not a palindrome.
`,
    boilerplate: {
      javascript: `function isPalindrome(x) {
  // Write your code here
  
}`,
      python: `def isPalindrome(x):
    # Write your code here
    pass`,
      pythonSolution: `def isPalindrome(x):
    if x < 0:
        return False
    return str(x) == str(x)[::-1]`
    },
    testCases: [
      { id: 1, input: [121], expectedOutput: true },
      { id: 2, input: [-121], expectedOutput: false },
      { id: 3, input: [10], expectedOutput: false },
      { id: 4, input: [1221], expectedOutput: true, isHidden: true },
      { id: 5, input: [999999], expectedOutput: true, isHidden: true },
      { id: 6, input: [123456], expectedOutput: false, isHidden: true }
    ],
    tags: ['math']
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    category: 'Stacks',
    difficulty: 'Medium',
    functionName: 'isValid',
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

### Example 1:
**Input:** \`s = "()"\`  
**Output:** \`true\`

### Example 2:
**Input:** \`s = "()[]{}"\`  
**Output:** \`true\`

### Example 3:
**Input:** \`s = "(]"\`  
**Output:** \`false\`
`,
    boilerplate: {
      javascript: `function isValid(s) {
  // Write your code here
  
}`,
      python: `def isValid(s):
    # Write your code here
    pass`,
      pythonSolution: `def isValid(s):
    stack = []
    mapping = {")": "(", "}": "{", "]": "["}
    for char in s:
        if char in mapping:
            top_element = stack.pop() if stack else '#'
            if mapping[char] != top_element:
                return False
        else:
            stack.append(char)
    return not stack`
    },
    testCases: [
      { id: 1, input: ['()'], expectedOutput: true },
      { id: 2, input: ['()[]{}'], expectedOutput: true },
      { id: 3, input: ['(]'], expectedOutput: false },
      { id: 4, input: ['([)]'], expectedOutput: false },
      { id: 5, input: ['{[]}'], expectedOutput: true, isHidden: true },
      { id: 6, input: ['['], expectedOutput: false, isHidden: true }
    ],
    tags: ['stacks']
  },
  {
    id: 'fibonacci-number',
    title: 'Fibonacci Number',
    category: 'Recursion',
    difficulty: 'Easy',
    functionName: 'fib',
    description: `The **Fibonacci numbers**, commonly denoted \`F(n)\` form a sequence, called the **Fibonacci sequence**, such that each number is the sum of the two preceding ones, starting from \`0\` and \`1\`. That is:

\`F(0) = 0, F(1) = 1\`  
\`F(n) = F(n - 1) + F(n - 2)\`, for \`n > 1\`.

Given \`n\`, calculate \`F(n)\`.

### Example 1:
**Input:** \`n = 2\`  
**Output:** \`1\`  
**Explanation:** F(2) = F(1) + F(0) = 1 + 0 = 1.

### Example 2:
**Input:** \`n = 3\`  
**Output:** \`2\`  
**Explanation:** F(3) = F(2) + F(1) = 1 + 1 = 2.

### Example 3:
**Input:** \`n = 4\`  
**Output:** \`3\`  
**Explanation:** F(4) = F(3) + F(2) = 2 + 1 = 3.
`,
    boilerplate: {
      javascript: `function fib(n) {
  // Write your code here
  
}`,
      python: `def fib(n):
    # Write your code here
    pass`,
      pythonSolution: `def fib(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b`
    },
    testCases: [
      { id: 1, input: [2], expectedOutput: 1 },
      { id: 2, input: [3], expectedOutput: 2 },
      { id: 3, input: [4], expectedOutput: 3 },
      { id: 4, input: [10], expectedOutput: 55, isHidden: true },
      { id: 5, input: [15], expectedOutput: 610, isHidden: true }
    ],
    tags: ['recursion']
  }
];
