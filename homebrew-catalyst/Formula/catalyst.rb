class Catalyst < Formula
  desc "Open-source ERP for research facilities"
  homepage "https://github.com/YOUR-ORG/catalyst-erp"
  url "https://github.com/YOUR-ORG/catalyst-erp/archive/refs/tags/catalyst-v1.tar.gz"
  version "1.0"
  license "MIT"

  depends_on "python@3.9"

  def install
    # Install the entire app into the Cellar
    libexec.install Dir["*"]

    # Create venv and install deps
    system "python3", "-m", "venv", libexec/"venv"
    system libexec/"venv/bin/pip", "install", "-q", "-r", libexec/"requirements.txt"

    # Create wrapper scripts in bin/
    (bin/"catalyst").write <<~EOS
      #!/bin/bash
      export CATALYST_HOME="#{libexec}"
      cd "#{libexec}"
      exec ./venv/bin/python -c "import app; app.app.run(host='0.0.0.0', port=5055)" "$@"
    EOS

    (bin/"catalyst-init").write <<~EOS
      #!/bin/bash
      export CATALYST_HOME="#{libexec}"
      cd "#{libexec}"
      mkdir -p data/demo data/operational logs
      [ -f .env ] || cat > .env << ENV
LAB_SCHEDULER_SECRET_KEY=$(./venv/bin/python -c "import secrets; print(secrets.token_hex(32))")
LAB_SCHEDULER_DEMO_MODE=1
LAB_SCHEDULER_CSRF=1
OWNER_EMAILS=admin@lab.local
ENV
      ./venv/bin/python -c "import app; app.init_db()"
      echo "CATALYST initialized. Run 'catalyst' to start."
    EOS

    (bin/"catalyst-test").write <<~EOS
      #!/bin/bash
      cd "#{libexec}"
      exec ./venv/bin/python scripts/smoke_test.py "$@"
    EOS
  end

  def post_install
    system bin/"catalyst-init"
  end

  def caveats
    <<~EOS
      CATALYST ERP installed.

      First run:
        catalyst-init      # Initialize database
        catalyst           # Start server on http://localhost:5055

      Login:
        Email:    owner@catalyst.local
        Password: 12345

      Configure:
        #{libexec}/.env

      Test:
        catalyst-test
    EOS
  end

  test do
    system bin/"catalyst-test"
  end
end
