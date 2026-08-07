# take all files in /test/ and fetch their names, rename each filename e.g. 3141431-test-1.png to test.png, same with 4141981-apfndjapvc.gif to apfndjapvc.gif, and move them to /test/renamed/
# if this file already exists, we make it file-1, then file-2, etc. until we find a name that doesn't exist yet
import os

# Create the renamed directory if it doesn't exist
os.makedirs('./test/renamed/', exist_ok=True)

for filename in os.listdir('./test/'):
    if os.path.isfile(os.path.join('./test/', filename)):
        # Split the filename into parts
        parts = filename.split('-')
        if len(parts) > 1:
            new_filename = '-'.join(parts[1:])  # Join all parts except the first one
        else:
            new_filename = filename  # If there's no '-', keep the original name

        # Check if the new filename already exists in the renamed directory
        base_name, extension = os.path.splitext(new_filename)
        counter = 1
        while os.path.exists(os.path.join('./test/renamed/', new_filename)):
            new_filename = f"{base_name}-{counter}{extension}"
            counter += 1

        # Move and rename the file
        os.rename(os.path.join('./test/', filename), os.path.join('./test/renamed/', new_filename))