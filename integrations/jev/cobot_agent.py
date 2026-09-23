"""Optional Jev desktop assistant; it never belongs in the camera frame loop."""
import argparse
import json
import os


def main():
    parser = argparse.ArgumentParser(description="Jev assistant for Cobot Lab")
    parser.add_argument('--url', default='https://xulytiengviet.github.io/cobot/')
    parser.add_argument('--goal', default=(
        'Inspect Cobot Lab. Read camera, AI performance, calibration and sync statuses. '
        'Do not open or close the camera, calibrate, or move the robot. '
        'Finish once those visible statuses have been inspected.'))
    args = parser.parse_args()
    missing = [key for key in ('TYPESAFE_API_KEY', 'TEXT_MODEL_API_KEY') if not os.environ.get(key)]
    if missing:
        parser.error('Missing environment variables: ' + ', '.join(missing))
    from jev_ultrafast import Agent
    with Agent(args.url, args.goal) as agent:
        for state in agent.run():
            print(json.dumps({'elapsed_ms': state.get('elapsed_ms'), 'status': state.get('status')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
