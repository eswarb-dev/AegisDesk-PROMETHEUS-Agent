import type { CodeLanguage, ParsedProblemStatement } from "./codingTypes.js";
import { normalizeCodeLanguage } from "./languageResolver.js";

export function languageFromText(text: string): CodeLanguage | undefined {
  const normalized = text.toLowerCase();
  const match = normalized.match(/\b(python3|py3|python|py|java|c\+\+|cpp|javascript|js|typescript|ts|c#|cs|csharp|c sharp)\b/);
  if (match) return normalizeCodeLanguage(match[1]);
  return undefined;
}

export function markdownLanguage(language: CodeLanguage): string {
  if (language === "python3") return "python";
  if (language === "cpp") return "cpp";
  if (language === "csharp") return "csharp";
  if (language === "javascript") return "javascript";
  if (language === "typescript") return "typescript";
  return language;
}

export function resolveKnownTemplate(problem: ParsedProblemStatement, language: CodeLanguage): string | undefined {
  const text = problem.rawPrompt.toLowerCase();
  if (/longest substring without (?:duplicate|repeating) characters/.test(text)) {
    return longestSubstringTemplate(language, problem.outputStyle === "full_program");
  }
  if (/\btwo sum\b/.test(text)) {
    return twoSumTemplate(language, problem.outputStyle === "full_program");
  }
  if (/\bmedian of two sorted arrays\b/.test(text)) {
    return medianSortedArraysTemplate(language);
  }
  return undefined;
}

function longestSubstringTemplate(language: CodeLanguage, fullProgram: boolean): string {
  if (language === "java") {
    return fullProgram
      ? `import java.util.*;

public class Main {
    public static int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> seen = new HashMap<>();
        int left = 0;
        int best = 0;

        for (int right = 0; right < s.length(); right++) {
            char ch = s.charAt(right);
            if (seen.containsKey(ch) && seen.get(ch) >= left) {
                left = seen.get(ch) + 1;
            }
            seen.put(ch, right);
            best = Math.max(best, right - left + 1);
        }

        return best;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        System.out.println(lengthOfLongestSubstring(s));
    }
}`
      : `class Solution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> seen = new HashMap<>();
        int left = 0;
        int best = 0;

        for (int right = 0; right < s.length(); right++) {
            char ch = s.charAt(right);
            if (seen.containsKey(ch) && seen.get(ch) >= left) {
                left = seen.get(ch) + 1;
            }
            seen.put(ch, right);
            best = Math.max(best, right - left + 1);
        }

        return best;
    }
}`;
  }
  if (language === "cpp") {
    return fullProgram
      ? `#include <bits/stdc++.h>
using namespace std;

int lengthOfLongestSubstring(const string& s) {
    unordered_map<char, int> seen;
    int left = 0, best = 0;

    for (int right = 0; right < (int)s.size(); right++) {
        char ch = s[right];
        if (seen.count(ch) && seen[ch] >= left) {
            left = seen[ch] + 1;
        }
        seen[ch] = right;
        best = max(best, right - left + 1);
    }

    return best;
}

int main() {
    string s;
    getline(cin, s);
    cout << lengthOfLongestSubstring(s) << '\\n';
    return 0;
}`
      : `class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_map<char, int> seen;
        int left = 0, best = 0;

        for (int right = 0; right < (int)s.size(); right++) {
            char ch = s[right];
            if (seen.count(ch) && seen[ch] >= left) {
                left = seen[ch] + 1;
            }
            seen[ch] = right;
            best = max(best, right - left + 1);
        }

        return best;
    }
};`;
  }
  return `class Solution:
    def lengthOfLongestSubstring(self, s):
        seen = {}
        left = 0
        best = 0

        for right, ch in enumerate(s):
            if ch in seen and seen[ch] >= left:
                left = seen[ch] + 1

            seen[ch] = right
            best = max(best, right - left + 1)

        return best`;
}

function twoSumTemplate(language: CodeLanguage, fullProgram: boolean): string {
  if (language === "java") {
    return `class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            if (seen.containsKey(need)) {
                return new int[] { seen.get(need), i };
            }
            seen.put(nums[i], i);
        }
        return new int[] {};
    }
}`;
  }
  if (language === "cpp") {
    return fullProgram
      ? `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, target;
    cin >> n >> target;
    vector<int> nums(n);
    for (int& x : nums) cin >> x;
    unordered_map<int, int> seen;
    for (int i = 0; i < n; i++) {
        int need = target - nums[i];
        if (seen.count(need)) {
            cout << seen[need] << " " << i << '\\n';
            return 0;
        }
        seen[nums[i]] = i;
    }
    return 0;
}`
      : `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            int need = target - nums[i];
            if (seen.count(need)) return {seen[need], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`;
  }
  return `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, value in enumerate(nums):
            need = target - value
            if need in seen:
                return [seen[need], i]
            seen[value] = i
        return []`;
}

function medianSortedArraysTemplate(language: CodeLanguage): string | undefined {
  if (language !== "python" && language !== "python3") return undefined;
  return `class Solution:
    def findMedianSortedArrays(self, nums1, nums2):
        if len(nums1) > len(nums2):
            nums1, nums2 = nums2, nums1

        m, n = len(nums1), len(nums2)
        total_left = (m + n + 1) // 2
        left, right = 0, m

        while left <= right:
            i = (left + right) // 2
            j = total_left - i

            nums1_left = float("-inf") if i == 0 else nums1[i - 1]
            nums1_right = float("inf") if i == m else nums1[i]
            nums2_left = float("-inf") if j == 0 else nums2[j - 1]
            nums2_right = float("inf") if j == n else nums2[j]

            if nums1_left <= nums2_right and nums2_left <= nums1_right:
                if (m + n) % 2 == 1:
                    return float(max(nums1_left, nums2_left))
                return (max(nums1_left, nums2_left) + min(nums1_right, nums2_right)) / 2.0

            if nums1_left > nums2_right:
                right = i - 1
            else:
                left = i + 1

        return 0.0`;
}
