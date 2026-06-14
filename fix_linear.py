import re

with open('web/src/tokens/primitives/linear.css', 'r') as f:
    css = f.read()

# Fix header
css = css.replace("GREEN BASED", "CORAL/TEAL BASED")

# Replace Light Action Gradients
css = re.sub(
    r'--linear-action: linear-gradient\(#054a30, #07a45f\);',
    '--linear-action: linear-gradient(135deg, #FF6B6B, #4ECDC4);',
    css
)
css = re.sub(
    r'--linear-action-hover: linear-gradient\(#07a45f, #09d379\);',
    '--linear-action-hover: linear-gradient(135deg, #ff8585, #6be2da);',
    css
)
css = re.sub(
    r'--linear-button: linear-gradient\(#065a3b, #076b46\);',
    '--linear-button: linear-gradient(#D15555, #FF6B6B);',
    css
)
css = re.sub(
    r'--linear-button-hover: linear-gradient\(#076b46, #09d379\);',
    '--linear-button-hover: linear-gradient(#FF6B6B, #ff8585);',
    css
)

# Replace Dark Action Gradients
css = re.sub(
    r'--linear-action: linear-gradient\(#09d379, #07a45f\);',
    '--linear-action: linear-gradient(135deg, #4ECDC4, #FF6B6B);',
    css
)
css = re.sub(
    r'--linear-action-hover: linear-gradient\(#2ddb8d, #09d379\);',
    '--linear-action-hover: linear-gradient(135deg, #6be2da, #ff8585);',
    css
)
css = re.sub(
    r'--linear-button-hover: linear-gradient\(#07a45f, #09d379\);',
    '--linear-button-hover: linear-gradient(#FF6B6B, #ff8585);',
    css
)

# Replace Light Brand Gradients
css = re.sub(
    r'--linear-brand: linear-gradient\(103\.53deg, #054a30 -6\.72%, #07a45f 109\.77%\);',
    '--linear-brand: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);',
    css
)
css = re.sub(
    r'--linear-brand-alt: linear-gradient\(0deg, #076b46 0%, #09d379 100%\);',
    '--linear-brand-alt: linear-gradient(0deg, #4ECDC4 0%, #FF6B6B 100%);',
    css
)
css = re.sub(
    r'--linear-brand-light: linear-gradient\(90deg, #09d379 0%, #07a45f 100%\);',
    '--linear-brand-light: linear-gradient(90deg, #FF6B6B 0%, #4ECDC4 100%);',
    css
)

# Replace Dark Brand Gradients
css = re.sub(
    r'--linear-brand-alt: linear-gradient\(0deg, #09d379 0%, #2ddb8d 100%\);',
    '--linear-brand-alt: linear-gradient(0deg, #4ECDC4 0%, #FF6B6B 100%);',
    css
)
css = re.sub(
    r'--linear-brand-light: linear-gradient\(90deg, #2ddb8d 0%, #054a30 100%\);',
    '--linear-brand-light: linear-gradient(90deg, #FF6B6B 0%, #4ECDC4 100%);',
    css
)

# Replace the complex light brand gradient
complex_light = """--linear-brand-complex: linear-gradient(
    135deg,
    #FF6B6B 0%,
    #ff8585 20%,
    #4ECDC4 80%,
    #2bb2a9 100%
  );"""
css = re.sub(r'--linear-brand-complex: linear-gradient\([\s\S]*?#9bf3c9\n  \);', complex_light, css)

# Replace the complex dark brand gradient
complex_dark = """--linear-brand-complex: linear-gradient(
    135deg,
    #4ECDC4 0%,
    #6be2da 20%,
    #FF6B6B 80%,
    #ff8585 100%
  );"""
css = re.sub(r'--linear-brand-complex: linear-gradient\([\s\S]*?#054a30\n  \);', complex_dark, css)

# Fix dark background fade #0f0f0f to #050505
css = css.replace('#0f0f0f', '#050505')

with open('web/src/tokens/primitives/linear.css', 'w') as f:
    f.write(css)

print("Linear updated")
